import { Quaternion, Vector3, type Bone } from "three";
import { solveTwoBone } from "@/lib/limb-ik";
import type { HandPlan } from "./figure-hands";
import { aim, rollToward, rotateWorld, squash, tipWorld, worldPos, type Segment } from "./rig-math";

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
  /** The finger and thumb bones with their descendants, for curling. */
  fingerChain: Bone[];
  thumbChain: Bone[];
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
export function chainOf(root: Bone | null): Bone[] {
  const out: Bone[] = [];
  root?.traverse((o) => {
    if ((o as Bone).isBone) out.push(o as Bone);
  });
  return out;
}

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
  const bend = (chain: Bone[], root: Bone | null, deg: number) => {
    if (!root || !chain.length || !deg) return;
    const base = worldPos(root.parent ?? root, _a).clone();
    const dir = worldPos(root, _b).clone().sub(base).normalize();
    // Rotating `dir` about dir x palm swings it toward the palm.
    _lat.crossVectors(dir, _palm);
    if (_lat.lengthSq() < 1e-8) return;
    _lat.normalize();
    const per = deg / chain.length;
    for (const b of chain) rotateWorld(b, _lat, per);
  };
  bend(s.fingerChain, s.finger, plan.curl.fingers);
  bend(s.thumbChain, s.thumb, plan.curl.thumb);
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
  curlDigits(s, plan);
}
