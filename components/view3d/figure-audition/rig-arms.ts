import { Quaternion, Vector3, type Bone, type Object3D } from "three";
import { solveTwoBone } from "@/lib/limb-ik";
import type { HandPlan } from "./figure-hands";
import { aim, chainOf, rollToward, rotateWorld, squash, tipWorld, worldPos, type Segment } from "./rig-math";
import { buildGraft, graftScale, placeGraft, type HandFit, type HandGraft, type HandSources } from "./hand-graft";

export { chainOf };

/** Palm roll never twists a wrist past this. */
const PALM_ROLL_MAX_DEG = 60;

export interface SideRig {
  upperLeg: Bone;
  lowerLeg: Bone;
  foot: Bone;
  upperArm: Bone;
  foreArm: Bone;
  hand: Bone;
  /** Clavicle or shoulder bone above the upper arm, if the rig has one. */
  clavicle: Bone | null;
  /** A finger bone on the hand, if the rig has one: gives the hand a direction. */
  finger: Bone | null;
  /** Thumb bone, if any: with the fingers it gives the palm's direction. */
  thumb: Bone | null;
  /** Finger chains (root first) and the thumb chain, for curling: one chain for a mitten, four for a grafted hand. */
  fingerChains: Bone[][];
  thumbChain: Bone[];
  /** A five-fingered hand worn over this one, if grafted. */
  graft: HandGraft | null;
  upperLen: number;
  foreLen: number;
  /** Foot orientation in the rest pose (world, yaw-fixed): feet stay flat. */
  footRest: Quaternion;
  /** Palm normal in the hand's local frame, from the rest pose. */
  palmLocal: Vector3 | null;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _v = new Vector3();
const _dir = new Vector3();
const _pole = new Vector3();
const _sh = new Vector3();
const _axis = new Vector3();
const _palm = new Vector3();
const _want = new Vector3();
const _lat = new Vector3();
const _q = new Quaternion();

/** Direct child bones of a bone. */
const childBones = (b: Bone) => b.children.filter((c) => (c as Bone).isBone) as Bone[];

/** A bone and every bone below it, top first. */

/**
 * Among the hand's children, the finger is the one that continues the
 * forearm best and the thumb the one that departs from it most; names
 * win when they say so (Biped "Finger0" is the thumb).
 */
export function findDigits(hand: Bone, foreArm: Bone): { finger: Bone | null; thumb: Bone | null } {
  const kids = childBones(hand);
  if (!kids.length) return { finger: null, thumb: null };
  const armDir = worldPos(hand, _a).clone().sub(worldPos(foreArm, _b)).normalize();
  const handPos = worldPos(hand, _c).clone();
  const scored = kids.map((k) => {
    const n = squash(k.name);
    const d = worldPos(k, _v).clone().sub(handPos).normalize().dot(armDir);
    const thumbName = /thumb|finger0(?!\d)/.test(n);
    return { k, d, thumbName };
  });
  const finger =
    scored.filter((s) => !s.thumbName).sort((x, y) => y.d - x.d)[0]?.k ??
    scored.sort((x, y) => y.d - x.d)[0]?.k ??
    null;
  const thumb =
    scored.find((s) => s.thumbName)?.k ??
    (kids.length > 1 ? scored.sort((x, y) => x.d - y.d)[0]?.k ?? null : null);
  return { finger, thumb: thumb === finger ? null : thumb };
}

/** Close the fingers and the thumb toward the palm by the plan's angles. */
function curlDigits(s: SideRig, plan: HandPlan) {
  if (!s.palmLocal) return;
  s.hand.getWorldQuaternion(_q);
  _palm.copy(s.palmLocal).applyQuaternion(_q);
  const bend = (chains: Bone[][], deg: number) => {
    if (!deg) return;
    for (const chain of chains) {
      const root = chain[0];
      if (!root) continue;
      const base = worldPos(root.parent ?? root, _a).clone();
      const dir = worldPos(root, _b).clone().sub(base).normalize();
      // Rotating `dir` about dir x palm swings it toward the palm.
      _lat.crossVectors(dir, _palm);
      if (_lat.lengthSq() < 1e-8) continue;
      _lat.normalize();
      const per = deg / chain.length;
      for (const b of chain) rotateWorld(b, _lat, per);
    }
  };
  bend(s.fingerChains, plan.curl.fingers);
  bend(s.thumbChain.length ? [s.thumbChain] : [], plan.curl.thumb);
}

/**
 * Reach, aim, roll and curl one arm onto its hand plan. `k` is the
 * figure scale, `reach` the per-model arm reach multiplier.
 */
export function poseArm(
  segments: Map<Bone, Segment>,
  s: SideRig,
  side: 1 | -1,
  plan: HandPlan,
  k: number,
  reach: number,
  shoulderDropDeg: number,
) {
  // Rest poses shrug: drop the shoulder tip once the arm hangs.
  if (s.clavicle) tipWorld(s.clavicle, side * shoulderDropDeg);
  const sh = worldPos(s.upperArm, _sh);
  _pole.set(plan.pole.x, plan.pole.y, plan.pole.z);
  const solve = solveTwoBone(sh, plan.target, s.upperLen * k * reach, s.foreLen * k * reach, _pole);
  aim(segments, s.upperArm, s.foreArm, _dir.set(solve.mid.x - sh.x, solve.mid.y - sh.y, solve.mid.z - sh.z), k);
  worldPos(s.foreArm, _a);
  aim(segments, s.foreArm, s.hand, _dir.set(solve.end.x - _a.x, solve.end.y - _a.y, solve.end.z - _a.z), k);
  // Fingers point where the plan says; then roll the forearm so the
  // palm faces what the hand is on, which the twist-free aim ignores.
  const fingers = () => {
    if (s.finger) aim(segments, s.hand, s.finger, _dir.set(plan.fingers.x, plan.fingers.y, plan.fingers.z), k);
  };
  fingers();
  if (s.palmLocal) {
    s.hand.getWorldQuaternion(_q);
    _palm.copy(s.palmLocal).applyQuaternion(_q);
    _axis.set(solve.end.x - _a.x, solve.end.y - _a.y, solve.end.z - _a.z).normalize();
    rollToward(s.foreArm, _axis, _palm, _want.set(plan.palm.x, plan.palm.y, plan.palm.z), PALM_ROLL_MAX_DEG);
    fingers();
  }
  // A grafted hand rides the posed hand bone; its fingers curl below.
  if (s.graft) placeGraft(s.graft, s.hand);
  curlDigits(s, plan);
}

/** Half the thickness of a controller grip: the grip's center sits this far off the palm. */
const GRIP_RADIUS = 1.8;

/**
 * Where a held grip's center is for this hand, in world cm: between the
 * thumb root and the finger roots (the palm's crease), pushed off the
 * palm by a grip's radius. Falls back to a point along the hand when the
 * rig has no digits.
 */
export function gripPoint(s: SideRig, out: Vector3): Vector3 {
  worldPos(s.hand, out);
  const f = s.finger ? worldPos(s.finger, _a) : null;
  const t = s.thumb ? worldPos(s.thumb, _b) : null;
  if (f && t) out.addVectors(f, t).multiplyScalar(0.5);
  else if (f) out.lerp(f, 0.6);
  if (s.palmLocal) {
    s.hand.getWorldQuaternion(_q);
    out.addScaledVector(_palm.copy(s.palmLocal).applyQuaternion(_q), GRIP_RADIUS);
  }
  return out;
}

/**
 * Measure a hand in the rest pose: its index and thumb roots, their
 * chains, and the palm normal in the hand bone's frame (fingers x thumb
 * for the left hand, thumb x fingers for the right; without a thumb the
 * tuning decides). When the model asks for it and the hand assets are
 * loaded, a five-fingered graft is built from that frame and its digits
 * take over from the model's own.
 */
export function fitHand(
  s: SideRig,
  side: 1 | -1,
  tuning: { palm: "auto" | "down" | "in" | "back"; graftHands: boolean },
  hands: HandSources | null,
  segment: (a: Bone, b: Bone) => void,
  grafts: Object3D,
) {
  const digits = findDigits(s.hand, s.foreArm);
  s.finger = digits.finger;
  s.thumb = digits.thumb;
  s.fingerChains = s.finger ? [chainOf(s.finger)] : [];
  s.thumbChain = chainOf(s.thumb);
  if (s.finger) segment(s.hand, s.finger);
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
  if (hands && tuning.graftHands) {
    const g = buildGraft(side === 1 ? hands.left : hands.right, side, fingerDir.clone().applyQuaternion(invHand), s.palmLocal);
    if (g) {
      s.graft = g;
      s.finger = g.finger;
      s.thumb = g.thumb;
      s.fingerChains = g.fingerChains;
      s.thumbChain = g.thumbChain;
      grafts.add(g.group);
    }
  }
}

/**
 * T-pose: leave the arms in their rest pose and only seat the grafted
 * hands on them (scaled for the figure), reporting grip points and wrist
 * targets for the overlay.
 */
export function restHands(
  sides: Record<1 | -1, SideRig>,
  heightCm: number,
  k: number,
  handScale: number,
  fit: HandFit,
  targetsOut: Vector3[],
  gripsOut: Vector3[],
) {
  for (const side of [1, -1] as const) {
    const s = sides[side];
    const i = side === 1 ? 0 : 1;
    if (s.graft) {
      s.graft.scale = graftScale(s.graft, heightCm, k, handScale, fit);
      placeGraft(s.graft, s.hand);
    }
    gripPoint(s, gripsOut[i]);
    targetsOut[i].copy(gripsOut[i]);
  }
}
