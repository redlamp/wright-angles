"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  Group,
  MathUtils,
  Matrix4,
  type Texture,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Bone,
  type Material,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { useFrame } from "@react-three/fiber";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { tweenProgress, tweenStep } from "@/lib/motion";
import { useReducedMotion } from "@/components/use-reduced-motion";
import { useViewerStore, type InputType, type Scenario } from "@/stores/viewer-store";
import type { HeldGrip } from "@/lib/viewing-geometry";
import type { ScenePalette } from "../scene-palette";
import {
  FADE_S,
  HEAD_CLEAR_CM,
  TWEEN_S,
  easeInOutCubic,
  lerpPose,
  makePose,
  type Pose,
} from "../viewer-figure";
import { candidateSwitched, naturalHeightCm, type Candidate, type RigTuning, type SideBones } from "./candidates";
import { AUDITION_READOUT_ID, NO_EYE_OFFSET, useAuditionStore, type EyeOffset, type FigureLook } from "./audition-store";
import { applyOutfit, assignPalette, computeRegions, headSpan, type MeshRegions } from "./figure-regions";
import RigOverlay from "./rig-overlay";
import { HANDHELD_LOOK_MAX_DEG, POSTURE, frameHands, lerpPosture } from "./figure-hands";
import { fitHand, gripPoint, poseArm, restHands, type SideRig } from "./rig-arms";
import { measureSeatDrop, seatOffset, type SeatOffset } from "./figure-seat";
import {
  aim,
  findBone,
  isUnder,
  legDir,
  lockEyes,
  pitchWorld,
  setWorldQuat,
  squash,
  type Segment,
  worldPos,
} from "./rig-math";
import ControllerProp from "./controller-prop";
import HandsFocus from "./hands-focus";

/** Height the capsule figure's pose numbers are authored at. */
export const AUTHORED_CM = 175;
/** Eye contract in capsule root-local cm (see viewer-figure). */
const EYE_LOCAL = 69;
/**
 * Eye line as a fraction of stature, the same ratio the viewer store's
 * eyeHeightCm uses for the standing eye point, so every model's eyes
 * land where the capsule's do. A model's head-span fraction can override
 * it through tuning.eyeFraction.
 */
const EYE_STATURE = 0.936;


export interface Rig {
  outer: Group;
  rest: [Bone, Quaternion, Vector3][];
  segments: Map<Bone, Segment>;
  sides: Record<1 | -1, SideRig>;
  pelvis: Bone | null;
  /** Bones between the pelvis and the head, pelvis side first. */
  spine: Bone[];
  head: Bone;
  /** Rest measurements at scale 1, after the yaw fix, in model units. */
  height: number;
  eyeY: number;
  /** Measured eye point in model space at rest, and the head's rest world matrix inverse. */
  eyeRest: Vector3;
  headRestInv: Matrix4;
  /** Scratch: the offset eye point in the head bone's frame. */
  eyeLocal: Vector3;
  /** Seated: thigh underside below the hip joints, model units. */
  seatDrop: number;
  meshes: { mesh: Mesh; own: Material | Material[] }[];
  gray: MeshStandardMaterial;
  outfitMat: MeshStandardMaterial;
  regions: MeshRegions[];
  tuning: Tuning;
  missing: string[];
  /** Readout stats: what the model costs. */
  tris: number;
  bones: number;
}

type Tuning = Required<Omit<RigTuning, "eyeFraction">> & Pick<RigTuning, "eyeFraction">;

const DEFAULT_TUNING: Tuning = {
  palm: "auto",
  reach: 1,
  handScale: 1,
};


const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _dir = new Vector3();

/** Skinned vertex reads use boneMatrices, which only a render refreshes. */
function updateSkeletons(rig: Rig) {
  for (const { mesh } of rig.meshes) if ((mesh as SkinnedMesh).isSkinnedMesh) (mesh as SkinnedMesh).skeleton.update();
}


export function buildRig(source: Object3D, c: Candidate): Rig {
  const model = cloneSkinned(source);
  const yaw = new Group();
  const outer = new Group();
  yaw.add(model);
  outer.add(yaw);
  outer.updateMatrixWorld(true);
  const tuning = { ...DEFAULT_TUNING, ...(c.tuning ?? {}) };

  const missing: string[] = [];
  const need = (name: string): Bone => {
    const b = findBone(model, name);
    if (!b) missing.push(name);
    return b as Bone;
  };
  const head = need(c.head);
  const bones = (
    s: SideBones,
  ): Omit<SideRig, "upperLen" | "foreLen" | "footRest" | "palmLocal" | "finger" | "thumb" | "fingerChains" | "thumbChain"> => {
    const upperArm = need(s.upperArm);
    const parent = upperArm?.parent as Bone | null;
    const clavicle = parent && parent.isBone && /clavicle|shoulder/.test(squash(parent.name)) ? parent : null;
    return {
      upperLeg: need(s.upperLeg),
      lowerLeg: need(s.lowerLeg),
      foot: need(s.foot),
      upperArm,
      foreArm: need(s.foreArm),
      hand: need(s.hand),
      clavicle,
    };
  };
  const left = bones(c.left);
  const right = bones(c.right);
  const pelvis = findBone(model, c.hips);
  const spine: Bone[] = [];
  if (head && pelvis && isUnder(head, pelvis)) {
    for (let p = head.parent; p && p !== pelvis; p = p.parent) {
      if ((p as Bone).isBone) spine.unshift(p as Bone);
    }
  }

  const meshes: Rig["meshes"] = [];
  model.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    // Posed limbs leave the bind-pose bounds; never cull the figure.
    m.frustumCulled = false;
    // SkeletonUtils.clone shares geometry with the source; the outfit
    // writes a color attribute, so give this rig its own copy. Faces
    // must not share vertices either, or region colors would blend
    // across them: polyart wants one color per face.
    m.geometry = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    const own = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    m.material = own;
    meshes.push({ mesh: m, own });
  });
  const gray = new MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const outfitMat = new MeshStandardMaterial({ roughness: 0.9, metalness: 0, vertexColors: true });
  const sideRig = (b: typeof left): SideRig => ({
    ...b,
    finger: null,
    thumb: null,
    fingerChains: [],
    thumbChain: [],
    upperLen: 0,
    foreLen: 0,
    footRest: new Quaternion(),
    palmLocal: null,
  });

  const rig: Rig = {
    outer,
    rest: [],
    segments: new Map(),
    sides: { [1]: sideRig(left), [-1]: sideRig(right) },
    pelvis,
    spine,
    head,
    height: 1,
    eyeY: 0,
    eyeRest: new Vector3(),
    headRestInv: new Matrix4(),
    eyeLocal: new Vector3(),
    seatDrop: 0,
    meshes,
    gray,
    outfitMat,
    regions: [],
    tuning,
    missing,
    tris: meshes.reduce((n, { mesh }) => {
      const g = mesh.geometry;
      return n + (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    }, 0),
    bones: 0,
  };
  if (missing.length) return rig;

  // Face +Z like the capsule figure: the character's left is +X.
  worldPos(left.upperArm, _a);
  worldPos(right.upperArm, _b);
  _c.subVectors(_a, _b).setY(0);
  yaw.rotation.y = -Math.atan2(-_c.z, _c.x);
  outer.updateMatrixWorld(true);
  updateSkeletons(rig);

  const box = new Box3().setFromObject(model, true);
  rig.height = box.max.y - box.min.y;
  const span = headSpan(rig);
  rig.eyeY =
    span && tuning.eyeFraction !== undefined
      ? span.min + (span.max - span.min) * tuning.eyeFraction
      : box.min.y + rig.height * EYE_STATURE;
  // The eyes sit a little behind the brow and nose: the face's front less
  // an eighth of the head's height. Kept in the head bone's frame so the
  // posed head reports where they are.
  worldPos(head, _a);
  const eyeZ = span ? span.front - (span.max - span.min) * 0.12 : _a.z;
  rig.eyeRest.set(_a.x, rig.eyeY, eyeZ);
  rig.headRestInv.copy(head.matrixWorld).invert();

  model.traverse((o) => {
    const b = o as Bone;
    if (b.isBone) rig.rest.push([b, b.quaternion.clone(), b.position.clone()]);
  });
  rig.bones = rig.rest.length;
  const segment = (bone: Bone, child: Bone) => {
    const from = worldPos(bone, new Vector3());
    const d = worldPos(child, new Vector3()).sub(from);
    const len = d.length();
    const inv = bone.getWorldQuaternion(new Quaternion()).invert();
    rig.segments.set(bone, { axis: d.normalize().applyQuaternion(inv), len });
  };
  for (const side of [1, -1] as const) {
    const s = rig.sides[side];
    s.upperLen = worldPos(s.upperArm, _a).distanceTo(worldPos(s.foreArm, _b));
    s.foreLen = worldPos(s.foreArm, _a).distanceTo(worldPos(s.hand, _b));
    s.foot.getWorldQuaternion(s.footRest);
    segment(s.upperLeg, s.lowerLeg);
    segment(s.lowerLeg, s.foot);
    segment(s.upperArm, s.foreArm);
    segment(s.foreArm, s.hand);
    fitHand(s, side, tuning, segment);
  }
  for (const [bone, q, pos] of rig.rest) {
    bone.quaternion.copy(q);
    bone.position.copy(pos);
  }
  // Stylized packs oversize the hands; scale lives on the hand bone so
  // the fingers and the hand mesh follow. Poses restore rotation and
  // position only, so this holds.
  for (const side of [1, -1] as const) rig.sides[side].hand.scale.setScalar(tuning.handScale);
  rig.seatDrop = measureSeatDrop(rig);
  outer.updateMatrixWorld(true);
  updateSkeletons(rig);
  rig.regions = computeRegions(rig);
  return rig;
}


function setLook(rig: Rig, look: FigureLook, grayColor: string, outfitId: string) {
  rig.gray.color.set(grayColor);
  if (look === "outfit") applyOutfit(rig.regions, outfitId);
  for (const { mesh, own } of rig.meshes)
    mesh.material = look === "gray" ? rig.gray : look === "outfit" ? rig.outfitMat : own;
}

/**
 * Blend only mid-fade. Opaque the rest of the time, because texture
 * alpha is not always coverage: some character maps pack a mask into
 * it, and blending on it can make whole bodies vanish.
 */
function setOpacity(rig: Rig, opacity: number) {
  rig.outer.visible = opacity > 0.01;
  const blend = opacity < 0.999;
  const apply = (m: Material) => {
    m.opacity = opacity;
    if (m.transparent !== blend) {
      m.transparent = blend;
      m.needsUpdate = true;
    }
  };
  apply(rig.gray);
  apply(rig.outfitMat);
  for (const { own } of rig.meshes) for (const m of Array.isArray(own) ? own : [own]) apply(m);
}


/** A stance the figure is in or moving toward. */
interface Stance {
  scenario: Scenario;
  input: InputType;
}

/**
 * Drive the rig from the capsule figure's pose numbers, blending hands
 * and posture from the previous stance to the next by `t` (the same
 * eased tween the body uses). Returns eye delta cm.
 */
export function poseRig(
  rig: Rig,
  p: Pose,
  from: Stance,
  to: Stance,
  t: number,
  held: HeldGrip | null,
  eye: EyeOffset,
  check: "off" | "t" | "hands",
  targetsOut: Vector3[],
  gripsOut: Vector3[],
  marksOut: Vector3[],
): number {
  for (const [bone, q, pos] of rig.rest) {
    bone.quaternion.copy(q);
    bone.position.copy(pos);
  }
  const heightCm = p.scale * AUTHORED_CM;
  const k = heightCm / rig.height;
  const eyeContract = p.rootY + EYE_LOCAL * p.scale;
  // First placement from the rest-pose eye line; corrected below once the
  // torso and head are posed, so the eyes end up exactly on the contract.
  rig.outer.scale.setScalar(k);
  rig.outer.position.set(0, eyeContract - rig.eyeY * k, 0);
  rig.outer.updateMatrixWorld(true);

  const hands = frameHands(check, from, to, t, p.rootY, p.scale, held);

  // Posture tweens with the body so the torso travels between stances.
  // T-pose: the rest pose; the eye lock still applies.
  const posture = check !== "off" ? POSTURE.standing : lerpPosture(POSTURE[from.scenario], POSTURE[to.scenario], t);
  if (rig.pelvis) pitchWorld(rig.pelvis, posture.pelvis);
  const chain = rig.spine.length ? rig.spine : rig.head.parent && (rig.head.parent as Bone).isBone ? [rig.head.parent as Bone] : [];
  for (const b of chain) pitchWorld(b, posture.spine / chain.length);
  let headDeg = posture.head;
  if (check === "off" && hands.lookAtHands > 0) {
    const handY = (hands.left.target.y + hands.right.target.y) / 2;
    const handZ = Math.max(1, (hands.left.target.z + hands.right.target.z) / 2);
    const down = MathUtils.radToDeg(Math.atan2(eyeContract - handY, handZ));
    headDeg += MathUtils.clamp(down, 0, HANDHELD_LOOK_MAX_DEG) * hands.lookAtHands;
  }
  pitchWorld(rig.head, headDeg);

  // Eye lock: the posed eyes go exactly to the eye point and the body hangs
  // from them. The per-model nudge is world cm; the rest point model units.
  rig.eyeLocal.copy(rig.eyeRest).add(_b.set(0, eye.up / k, eye.fwd / k)).applyMatrix4(rig.headRestInv);
  const lift = lockEyes(rig.outer, rig.head, rig.eyeLocal, eyeContract);

  if (check === "t") {
    restHands(rig.sides, targetsOut, gripsOut);
    marksOut[0].set(0, eyeContract, 0);
    worldPos(rig.head, marksOut[1]);
    return lift;
  }

  for (const side of [1, -1] as const) {
    const s = rig.sides[side];
    aim(rig.segments, s.upperLeg, s.lowerLeg, legDir(p.hipRot, _dir), k);
    aim(rig.segments, s.lowerLeg, s.foot, legDir(p.hipRot + p.kneeRot, _dir), k);
    // Feet stay flat whatever the shin does.
    setWorldQuat(s.foot, s.footRest);
  }

  poseArm(rig.segments, rig.sides[1], 1, hands.left, k, rig.tuning.reach, hands.shoulderDropDeg);
  poseArm(rig.segments, rig.sides[-1], -1, hands.right, k, rig.tuning.reach, hands.shoulderDropDeg);
  targetsOut[0].set(hands.left.target.x, hands.left.target.y, hands.left.target.z);
  targetsOut[1].set(hands.right.target.x, hands.right.target.y, hands.right.target.z);
  gripPoint(rig.sides[1], gripsOut[0]);
  gripPoint(rig.sides[-1], gripsOut[1]);
  marksOut[0].set(0, eyeContract, 0);
  worldPos(rig.head, marksOut[1]);
  return lift;
}

let lastReadout = 0;
function writeReadout(now: number, text: string) {
  if (now - lastReadout < 0.25) return;
  lastReadout = now;
  const el = document.getElementById(AUDITION_READOUT_ID);
  if (el) el.textContent = text;
}

/**
 * A glTF humanoid driven by the capsule figure's body numbers: height
 * scales the whole rig, stance aims the legs and sets the posture, the
 * input type places each hand (two-bone IK, finger aim, palm roll).
 * Same tween and the same proximity fade as the capsule figure.
 */
export default function RiggedFigure({
  source,
  candidate,
  scenario,
  inputType,
  heightCm,
  palette,
  held = null,
  look,
  outfit,
  showRig = false,
  texture,
}: {
  /** Loaded scene; cloned, never mutated. */
  source: Object3D;
  candidate: Candidate;
  /** Palette to assign to materials that have no map (packs that ship textures separately). */
  texture?: Texture;
  scenario: Scenario;
  inputType: InputType;
  heightCm: number;
  palette: ScenePalette;
  held?: HeldGrip | null;
  look: FigureLook;
  outfit: string;
  showRig?: boolean;
}) {
  const rig = useMemo(() => buildRig(source, candidate), [source, candidate]);
  // Switching models resets the height to the model's own, so each is
  // seen at the size it was built at rather than stretched to the last.
  const setHeightCm = useViewerStore((s) => s.setHeightCm);
  useEffect(() => {
    if (candidateSwitched(candidate.id)) setHeightCm(naturalHeightCm(rig.height, AUTHORED_CM));
  }, [candidate.id, rig, setHeightCm]);
  const pair = () => [new Vector3(), new Vector3()];
  const [targets, grips, marks] = [useRef<Vector3[]>(pair()), useRef<Vector3[]>(pair()), useRef<Vector3[]>(pair())];
  const eyeOffset = useAuditionStore((s) => s.eyeOffsets[candidate.id]) ?? NO_EYE_OFFSET;
  const eyeRef = useRef<EyeOffset>(NO_EYE_OFFSET);
  const tPose = useAuditionStore((s) => s.tPose);
  const handsView = useAuditionStore((s) => s.handsView);
  const checkRef = useRef<"off" | "t" | "hands">("off");
  useEffect(() => void (checkRef.current = handsView ? "hands" : tPose ? "t" : "off"), [tPose, handsView]);
  const setSeat = useAuditionStore((s) => s.setSeat);
  const seat = useRef<SeatOffset>({ dy: 0, dz: 0 });
  const published = useRef<SeatOffset>({ dy: NaN, dz: NaN });
  useEffect(() => () => setSeat(null), [setSeat]);
  // The device grip is planned at the destination eye height; the hands
  // must follow the live eye point through the tween, so the grip is
  // shifted by the eye's travel each frame.
  const heldLive = useRef<HeldGrip>({ distanceCm: 0, centerY: 0, wristY: 0, halfGripCm: 0 });
  useEffect(() => void (eyeRef.current = eyeOffset), [eyeOffset]);
  useEffect(() => setLook(rig, look, palette.figure, outfit), [rig, look, outfit, palette]);
  useEffect(() => assignPalette(rig.meshes, texture), [rig, texture]);
  useEffect(() => {
    if (rig.missing.length) console.warn(`[figure-audition] ${candidate.id} missing bones:`, rig.missing);
  }, [rig, candidate.id]);
  const reduced = useReducedMotion();

  const target = useMemo(
    () => makePose(scenario, inputType, heightCm, held),
    [scenario, inputType, heightCm, held],
  );
  const cur = useRef<Pose>(target);
  const stance = useRef<Stance>({ scenario, input: inputType });
  const anim = useRef<{ from: Pose; fromStance: Stance; start: number | null } | null>(null);
  const prevTarget = useRef(target);
  const poseKey = `${scenario}/${inputType}`;
  const prevPoseKey = useRef(poseKey);
  useEffect(() => {
    if (prevTarget.current !== target) {
      if (prevPoseKey.current !== poseKey) {
        // Leaving mid-tween: start from where the hands actually are.
        anim.current = { from: cur.current, fromStance: stance.current, start: null };
      } else {
        anim.current = null;
        cur.current = target;
      }
      prevTarget.current = target;
    }
    prevPoseKey.current = poseKey;
  }, [target, poseKey]);

  const opacity = useRef(0);
  const headCenter = useRef(new Vector3());
  /** 0..1 how present the controller prop is; the frame loop writes it. */
  const controllerBlend = useRef(0);

  useFrame((state, delta) => {
    const a = anim.current;
    let t = 1;
    if (a) {
      if (a.start === null) a.start = state.clock.elapsedTime;
      t = easeInOutCubic(tweenProgress(state.clock.elapsedTime - a.start, TWEEN_S, reduced));
      cur.current = t >= 1 ? target : lerpPose(a.from, target, t);
      if (t >= 1) {
        anim.current = null;
        stance.current = { scenario, input: inputType };
      }
      state.invalidate();
    } else {
      stance.current = { scenario, input: inputType };
    }
    const from = a ? a.fromStance : stance.current;
    const to: Stance = { scenario, input: inputType };
    controllerBlend.current = MathUtils.lerp(from.input === "gamepad" ? 1 : 0, to.input === "gamepad" ? 1 : 0, t);
    const pose = cur.current;
    headCenter.current.set(0, pose.rootY + EYE_LOCAL * pose.scale, 0);
    const fadeTarget = state.camera.position.distanceTo(headCenter.current) < HEAD_CLEAR_CM ? 0 : 1;
    if (opacity.current !== fadeTarget) {
      const step = tweenStep(delta, FADE_S, reduced);
      opacity.current =
        fadeTarget > opacity.current
          ? Math.min(fadeTarget, opacity.current + step)
          : Math.max(fadeTarget, opacity.current - step);
      state.invalidate();
    }
    setOpacity(rig, opacity.current);
    if (rig.missing.length) {
      writeReadout(state.clock.elapsedTime, `missing bones: ${rig.missing.join(", ")}`);
      return;
    }
    let h: HeldGrip | null = null;
    if (held) {
      const travel = pose.rootY + EYE_LOCAL * pose.scale - (target.rootY + EYE_LOCAL * target.scale);
      h = Object.assign(heldLive.current, held, { centerY: held.centerY + travel, wristY: held.wristY + travel });
    }
    const eyeDelta = poseRig(rig, pose, from, to, t, h, eyeRef.current, checkRef.current, targets.current, grips.current, marks.current);
    if (seatOffset(rig, rig.seatDrop, rig.outer.scale.x, checkRef.current !== "off" ? "standing" : scenario, seat.current)) {
      const s = seat.current;
      if (Math.abs(s.dy - published.current.dy) > 0.1 || Math.abs(s.dz - published.current.dz) > 0.1 || Number.isNaN(published.current.dy)) {
        published.current = { dy: s.dy, dz: s.dz };
        setSeat(published.current);
      }
    }
    writeReadout(
      state.clock.elapsedTime,
      `eye lock lifted the body ${eyeDelta >= 0 ? "+" : ""}${eyeDelta.toFixed(1)} cm · ` +
        `${Math.round(rig.tris).toLocaleString()} tris · ${rig.bones} bones` +
        (rig.sides[1].thumb ? " · palm from thumb" : " · palm from tuning") +
        (eyeRef.current.up || eyeRef.current.fwd ? ` · eyes ${eyeRef.current.up} up, ${eyeRef.current.fwd} fwd` : "") +
        (controllerBlend.current > 0.5 ? ` · grips ${grips.current[0].distanceTo(grips.current[1]).toFixed(1)} cm apart` : ""),
    );
  });

  return (
    <>
      <primitive object={rig.outer} userData={{ orbitPivot: "base" }} />
      <HandsFocus sides={rig.sides} />
      {showRig && !rig.missing.length ? <RigOverlay root={rig.outer} targets={targets} marks={marks} /> : null}
      {!rig.missing.length ? <ControllerProp grips={grips} blend={controllerBlend} /> : null}
    </>
  );
}
