"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  Group,
  MathUtils,
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
import type { InputType, Scenario } from "@/stores/viewer-store";
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
import type { Candidate, RigTuning, SideBones } from "./candidates";
import { AUDITION_READOUT_ID, type FigureLook } from "./audition-store";
import { applyOutfit, computeRegions, dominantBone, headSpan, type MeshRegions } from "./figure-regions";
import RigOverlay from "./rig-overlay";
import { HANDHELD_LOOK_MAX_DEG, POSTURE, lerpHands, lerpPosture, planHands } from "./figure-hands";
import { chainOf, findDigits, gripPoint, poseArm, type SideRig } from "./rig-arms";
import {
  aim,
  findBone,
  isUnder,
  legDir,
  pitchWorld,
  setWorldQuat,
  squash,
  worldPos,
  type Segment,
} from "./rig-math";
import ControllerProp from "./controller-prop";

/** Height the capsule figure's pose numbers are authored at. */
const AUTHORED_CM = 175;
/** Eye contract in capsule root-local cm (see viewer-figure). */
const EYE_LOCAL = 69;
/** Capsule pelvis root sits this far above the seat plane (viewer-figure). */
const ROOT_ABOVE_SEAT = 10;
/**
 * Eye line as a fraction of the head's own vertex span, chin to crown.
 * Eyes sit at about the middle of the skull on every body type, which
 * beats guessing from where a rig happens to put its head joint.
 */
const EYE_FRACTION_OF_HEAD = 0.55;


interface Rig {
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
  minY: number;
  /** Mean hip-joint (thigh root) height. */
  hipJointY: number;
  /** Seated: hip joint height above the underside of the thighs. */
  seatDrop: number;
  eyeY: number;
  meshes: { mesh: Mesh; own: Material | Material[] }[];
  gray: MeshStandardMaterial;
  outfitMat: MeshStandardMaterial;
  regions: MeshRegions[];
  tuning: Required<RigTuning>;
  missing: string[];
  /** Readout stats: what the model costs. */
  tris: number;
  bones: number;
}

const DEFAULT_TUNING: Required<RigTuning> = {
  eyeFraction: EYE_FRACTION_OF_HEAD,
  palm: "auto",
  reach: 1,
  handScale: 1,
};


const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _v = new Vector3();
const _dir = new Vector3();

/** Skinned vertex reads use boneMatrices, which only a render refreshes. */
function updateSkeletons(rig: Rig) {
  for (const { mesh } of rig.meshes) {
    const sk = mesh as SkinnedMesh;
    if (sk.isSkinnedMesh) sk.skeleton.update();
  }
}


/**
 * Sit the rig (thighs forward) and find the underside of its thighs:
 * the lowest skinned vertex driven mostly by a thigh bone. Rigs put the
 * thigh joint anywhere from the femoral head to the crotch line, so a
 * fixed joint-to-seat offset left some bodies hovering 13cm up.
 */
function measureSeatDrop(rig: Rig): number {
  for (const side of [1, -1] as const) {
    const s = rig.sides[side];
    aim(rig.segments, s.upperLeg, s.lowerLeg, legDir(-Math.PI / 2, _dir), 1);
  }
  updateSkeletons(rig);
  const thighs = new Set<Bone>([rig.sides[1].upperLeg, rig.sides[-1].upperLeg]);
  let minY = Infinity;
  for (const { mesh } of rig.meshes) {
    const sk = mesh as SkinnedMesh;
    if (!sk.isSkinnedMesh) continue;
    const n = sk.geometry.getAttribute("position").count;
    for (let i = 0; i < n; i++) {
      const bone = dominantBone(sk, i);
      if (!bone || !thighs.has(bone)) continue;
      sk.getVertexPosition(i, _v).applyMatrix4(sk.matrixWorld);
      if (_v.y < minY) minY = _v.y;
    }
  }
  return Number.isFinite(minY) ? rig.hipJointY - minY : 0;
}

function buildRig(source: Object3D, c: Candidate): Rig {
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
  ): Omit<SideRig, "upperLen" | "foreLen" | "footRest" | "palmLocal" | "finger" | "thumb" | "fingerChain" | "thumbChain"> => {
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
    fingerChain: [],
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
    minY: 0,
    hipJointY: 0,
    seatDrop: 0,
    eyeY: 0,
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
  rig.minY = box.min.y;
  rig.hipJointY = (worldPos(left.upperLeg, _a).y + worldPos(right.upperLeg, _b).y) / 2;
  const span = headSpan(rig);
  const headY = worldPos(head, _a).y;
  rig.eyeY = span
    ? span.min + (span.max - span.min) * tuning.eyeFraction
    : headY + (box.max.y - headY) * 0.45;

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
    const digits = findDigits(s.hand, s.foreArm);
    s.finger = digits.finger;
    s.thumb = digits.thumb;
    s.fingerChain = chainOf(s.finger);
    s.thumbChain = chainOf(s.thumb);
    if (s.finger) segment(s.hand, s.finger);
    // Palm normal: fingers x thumb for the left hand, thumb x fingers for
    // the right. Without a thumb, trust the tuning (T-poses: palms down).
    const handPos = worldPos(s.hand, _c).clone();
    const fingerDir = (s.finger ? worldPos(s.finger, _a) : worldPos(s.hand, _a).sub(worldPos(s.foreArm, _b)).add(handPos))
      .clone()
      .sub(handPos)
      .normalize();
    let palmWorld: Vector3 | null = null;
    if (tuning.palm === "auto" && s.thumb) {
      const thumbDir = worldPos(s.thumb, _b).clone().sub(handPos).normalize();
      palmWorld = side === 1 ? fingerDir.clone().cross(thumbDir) : thumbDir.clone().cross(fingerDir);
      if (palmWorld.lengthSq() < 1e-6) palmWorld = null;
    }
    if (!palmWorld) {
      palmWorld =
        tuning.palm === "in" ? new Vector3(-side, 0, 0) : tuning.palm === "back" ? new Vector3(0, 0, -1) : new Vector3(0, -1, 0);
    }
    const invHand = s.hand.getWorldQuaternion(new Quaternion()).invert();
    s.palmLocal = palmWorld.normalize().applyQuaternion(invHand);
  }
  rig.seatDrop = measureSeatDrop(rig);
  for (const [bone, q, pos] of rig.rest) {
    bone.quaternion.copy(q);
    bone.position.copy(pos);
  }
  // Stylized packs oversize the hands; scale lives on the hand bone so
  // the fingers and the hand mesh follow. Poses restore rotation and
  // position only, so this holds.
  for (const side of [1, -1] as const) rig.sides[side].hand.scale.setScalar(tuning.handScale);
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
function poseRig(
  rig: Rig,
  p: Pose,
  anchor: "body" | "eyes",
  from: Stance,
  to: Stance,
  t: number,
  held: HeldGrip | null,
  targetsOut: Vector3[],
  gripsOut: Vector3[],
): number {
  for (const [bone, q, pos] of rig.rest) {
    bone.quaternion.copy(q);
    bone.position.copy(pos);
  }
  const heightCm = p.scale * AUTHORED_CM;
  const k = heightCm / rig.height;
  const eyeContract = p.rootY + EYE_LOCAL * p.scale;
  const seated = MathUtils.clamp(-p.hipRot / (Math.PI / 2), 0, 1);
  // Standing: soles on the floor. Seated: thigh roots where the capsule
  // figure's hip joints are, which puts the seat under the thighs.
  const seatPlane = p.rootY - ROOT_ABOVE_SEAT * p.scale;
  const seatY = seatPlane + (rig.seatDrop - rig.hipJointY) * k;
  const bodyY = MathUtils.lerp(-rig.minY * k, seatY, seated);
  const y = anchor === "eyes" ? eyeContract - rig.eyeY * k : bodyY;
  rig.outer.scale.setScalar(k);
  rig.outer.position.set(0, y, 0);
  rig.outer.updateMatrixWorld(true);

  // Posture tweens with the body so the torso travels between stances.
  const posture = lerpPosture(POSTURE[from.scenario], POSTURE[to.scenario], t);
  if (rig.pelvis) pitchWorld(rig.pelvis, posture.pelvis);
  const chain = rig.spine.length ? rig.spine : rig.head.parent && (rig.head.parent as Bone).isBone ? [rig.head.parent as Bone] : [];
  for (const b of chain) pitchWorld(b, posture.spine / chain.length);
  let headDeg = posture.head;

  for (const side of [1, -1] as const) {
    const s = rig.sides[side];
    aim(rig.segments, s.upperLeg, s.lowerLeg, legDir(p.hipRot, _dir), k);
    aim(rig.segments, s.lowerLeg, s.foot, legDir(p.hipRot + p.kneeRot, _dir), k);
    // Feet stay flat whatever the shin does.
    setWorldQuat(s.foot, s.footRest);
  }

  const hands =
    t >= 1
      ? lerpHands(planHands(to.scenario, to.input, p.rootY, p.scale, held), planHands(to.scenario, to.input, p.rootY, p.scale, held), 1)
      : lerpHands(
          planHands(from.scenario, from.input, p.rootY, p.scale, held),
          planHands(to.scenario, to.input, p.rootY, p.scale, held),
          t,
        );
  poseArm(rig.segments, rig.sides[1], 1, hands.left, k, rig.tuning.reach, hands.shoulderDropDeg);
  poseArm(rig.segments, rig.sides[-1], -1, hands.right, k, rig.tuning.reach, hands.shoulderDropDeg);
  targetsOut[0].set(hands.left.target.x, hands.left.target.y, hands.left.target.z);
  targetsOut[1].set(hands.right.target.x, hands.right.target.y, hands.right.target.z);
  gripPoint(rig.sides[1], gripsOut[0]);
  gripPoint(rig.sides[-1], gripsOut[1]);

  if (hands.lookAtHands > 0) {
    const eyeWorldY = y + rig.eyeY * k;
    const handY = (hands.left.target.y + hands.right.target.y) / 2;
    const handZ = Math.max(1, (hands.left.target.z + hands.right.target.z) / 2);
    const down = MathUtils.radToDeg(Math.atan2(eyeWorldY - handY, handZ));
    headDeg += MathUtils.clamp(down, 0, HANDHELD_LOOK_MAX_DEG) * hands.lookAtHands;
  }
  pitchWorld(rig.head, headDeg);
  return y + rig.eyeY * k - eyeContract;
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
  anchor,
  showRig = false,
}: {
  /** Loaded scene; cloned, never mutated. */
  source: Object3D;
  candidate: Candidate;
  scenario: Scenario;
  inputType: InputType;
  heightCm: number;
  palette: ScenePalette;
  held?: HeldGrip | null;
  look: FigureLook;
  outfit: string;
  anchor: "body" | "eyes";
  showRig?: boolean;
}) {
  const rig = useMemo(() => buildRig(source, candidate), [source, candidate]);
  const targets = useRef<Vector3[]>([new Vector3(), new Vector3()]);
  const grips = useRef<Vector3[]>([new Vector3(), new Vector3()]);
  useEffect(() => setLook(rig, look, palette.figure, outfit), [rig, look, outfit, palette]);
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
    const eyeDelta = poseRig(rig, pose, anchor, from, to, t, held, targets.current, grips.current);
    writeReadout(
      state.clock.elapsedTime,
      `eyes ${eyeDelta >= 0 ? "+" : ""}${eyeDelta.toFixed(1)} cm vs eye point · ` +
        `${Math.round(rig.tris).toLocaleString()} tris · ${rig.bones} bones` +
        (rig.sides[1].thumb ? " · palm from thumb" : " · palm from tuning") +
        (controllerBlend.current > 0.5 ? ` · grips ${grips.current[0].distanceTo(grips.current[1]).toFixed(1)} cm apart` : ""),
    );
  });

  return (
    <>
      <primitive object={rig.outer} userData={{ orbitPivot: "base" }} />
      {showRig && !rig.missing.length ? <RigOverlay root={rig.outer} targets={targets} /> : null}
      {!rig.missing.length ? <ControllerProp grips={grips} blend={controllerBlend} /> : null}
    </>
  );
}
