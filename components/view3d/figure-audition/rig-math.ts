import { MathUtils, Quaternion, Vector3, type Bone, type Object3D } from "three";

/** A bone's rest segment: unit axis in its own local frame, and length. */
export interface Segment {
  axis: Vector3;
  len: number;
}

/** Loose name match: GLTFLoader strips ".", ":" and spaces from names. */
export const squash = (n: string) => n.replace(/[\s.:/[\]_-]/g, "").toLowerCase();

/**
 * `name` may list alternatives ("a|b"); a leading "*" matches by suffix,
 * for rigs that prefix every joint with the character's name.
 */
export function findBone(root: Object3D, name: string): Bone | null {
  for (const alt of name.split("|")) {
    const suffix = alt.startsWith("*");
    const want = squash(suffix ? alt.slice(1) : alt);
    let hit: Bone | null = null;
    root.traverse((o) => {
      if (hit || !(o as Bone).isBone) return;
      const n = squash(o.name);
      if (suffix ? n.endsWith(want) : n === want) hit = o as Bone;
    });
    if (hit) return hit;
  }
  return null;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _q = new Quaternion();
const _qw = new Quaternion();
const _qp = new Quaternion();
const _X = new Vector3(1, 0, 0);

export const worldPos = (o: Object3D, out: Vector3) => o.getWorldPosition(out);

export const isUnder = (o: Object3D, ancestor: Object3D) => {
  for (let p = o.parent; p; p = p.parent) if (p === ancestor) return true;
  return false;
};

/** Thigh/shin direction for a capsule-rig rotation.x (0 = hanging). */
export const legDir = (theta: number, out: Vector3) =>
  out.set(0, -Math.cos(theta), -Math.sin(theta));

/** Set a bone's world orientation. */
export function setWorldQuat(bone: Bone, q: Quaternion) {
  _qw.copy(q);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_qp);
    _qw.premultiply(_qp.invert());
  }
  bone.quaternion.copy(_qw);
  bone.updateMatrixWorld(true);
}

/**
 * Rotate `bone` in world space so its rest segment (toward `child`)
 * points along `dir`. The axis is the bone's own, not a live child
 * position: Quaternius rigs park feet on free IK-target bones that a
 * shin rotation never moves. Such a detached child is carried to the
 * segment's end instead.
 */
export function aim(
  segments: Map<Bone, Segment>,
  bone: Bone,
  child: Bone,
  dir: Vector3,
  k: number,
) {
  const seg = segments.get(bone);
  if (!seg) return;
  bone.getWorldQuaternion(_qw);
  _c.copy(seg.axis).applyQuaternion(_qw);
  _q.setFromUnitVectors(_c, _b.copy(dir).normalize());
  _qw.premultiply(_q);
  setWorldQuat(bone, _qw);
  if (!isUnder(child, bone) && child.parent) {
    worldPos(bone, _a).addScaledVector(_b, seg.len * k);
    child.position.copy(child.parent.worldToLocal(_a));
    child.updateMatrixWorld(true);
  }
}

/** Rotate a bone about a world-space unit axis by `deg`. */
export function rotateWorld(bone: Bone, axis: Vector3, deg: number) {
  if (!deg) return;
  _q.setFromAxisAngle(axis, MathUtils.degToRad(deg));
  bone.getWorldQuaternion(_qw);
  _qw.premultiply(_q);
  setWorldQuat(bone, _qw);
}

/**
 * Pitch a bone about the figure's lateral axis in world space (the
 * figure faces +Z, so that is world X). Positive tips its top forward.
 */
export const pitchWorld = (bone: Bone, deg: number) => rotateWorld(bone, _X, deg);

const _Z = new Vector3(0, 0, 1);

/**
 * Tip a bone about the figure's forward axis (world Z). Positive lowers
 * a bone that points to +X (the figure's left) and raises one pointing
 * to -X, so pass `side * deg` to drop both shoulder tips.
 */
export const tipWorld = (bone: Bone, deg: number) => rotateWorld(bone, _Z, -deg);

/**
 * Roll `bone` about `axis` (world, unit) so that `current` (world)
 * swings toward `desired` (world), both projected onto the plane
 * perpendicular to the axis. Clamped so a wrist never over-twists.
 */
export function rollToward(bone: Bone, axis: Vector3, current: Vector3, desired: Vector3, maxDeg = 120) {
  _a.copy(current).addScaledVector(axis, -current.dot(axis));
  _b.copy(desired).addScaledVector(axis, -desired.dot(axis));
  if (_a.lengthSq() < 1e-8 || _b.lengthSq() < 1e-8) return;
  _a.normalize();
  _b.normalize();
  const angle = Math.atan2(_c.crossVectors(_a, _b).dot(axis), _a.dot(_b));
  const limit = MathUtils.degToRad(maxDeg);
  _q.setFromAxisAngle(axis, MathUtils.clamp(angle, -limit, limit));
  bone.getWorldQuaternion(_qw);
  _qw.premultiply(_q);
  setWorldQuat(bone, _qw);
}

/** A bone and all its descendant bones, root first. */
export function chainOf(root: Bone | null): Bone[] {
  const out: Bone[] = [];
  root?.traverse((o) => {
    if ((o as Bone).isBone) out.push(o as Bone);
  });
  return out;
}
