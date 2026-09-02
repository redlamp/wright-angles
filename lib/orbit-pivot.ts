/**
 * Pure math for orbiting the 3D camera around an arbitrary pivot point (the
 * spot under the cursor at press time) instead of OrbitControls' fixed
 * `target`. See `components/view3d/pivot-orbit.tsx` for the pointer-event
 * wiring. No React, no DOM — see CLAUDE.md's "Geometry stays pure" rule.
 */
import { Quaternion, Vector3 } from "three";

const EPS = 1e-6;

/** Polar angle (radians, 0..π) of `offset` measured from world +Y — same
 * convention as three's `Spherical.phi`, so it lines up with OrbitControls'
 * `minPolarAngle`/`maxPolarAngle`. */
export function polarAngleFromY(offset: Vector3): number {
  const len = offset.length();
  if (len < EPS) return 0;
  return Math.acos(Math.min(1, Math.max(-1, offset.y / len)));
}

export interface RigidPose {
  position: Vector3;
  quaternion: Quaternion;
}

/**
 * Rotates a rigid body (position + orientation) by `angle` about `axis`,
 * pivoting around `pivot` — the position orbits the pivot on that axis, and
 * the orientation turns by the identical rotation, so everything the body
 * "sees" relative to itself is unchanged by the turn. That's what makes an
 * off-center pivot (a point that generally isn't where the camera is
 * currently looking) orbit correctly instead of re-aiming at it.
 */
export function rotateRigidAroundPivot(
  pose: RigidPose,
  pivot: Vector3,
  axis: Vector3,
  angle: number,
): RigidPose {
  if (Math.abs(angle) < EPS) {
    return { position: pose.position.clone(), quaternion: pose.quaternion.clone() };
  }
  const offset = pose.position.clone().sub(pivot).applyAxisAngle(axis, angle);
  const delta = new Quaternion().setFromAxisAngle(axis, angle);
  return {
    position: pivot.clone().add(offset),
    // World-space rotation composes by premultiplying.
    quaternion: delta.multiply(pose.quaternion),
  };
}

const WORLD_UP = new Vector3(0, 1, 0);

export interface PivotOrbitStepResult extends RigidPose {
  /** The pitch actually applied, after clamping to the polar-angle bounds
   * (magnitude ≤ |pitch| requested). Exposed for tests / debugging. */
  appliedPitch: number;
}

/** Pitch is walked in substeps this size (radians) so the clamp below can't
 * be fooled by sailing past a pole and back within bounds inside one big
 * jump — see stepPivotOrbit's doc comment. */
const PITCH_SUBSTEP = Math.PI / 256;

const inRange = (phi: number, min: number, max: number) => phi >= min && phi <= max;

const FORWARD = new Vector3(0, 0, -1);

/**
 * Polar angle of the VIEW DIRECTION — what OrbitControls will measure
 * once the drag hands off, because the handoff target sits on the
 * forward axis (offset = −forward·d, so offset.y/len = −forward.y).
 * The pivot is off that axis, so clamping the camera's position around
 * the pivot alone is not enough: a click on the floor near the bottom
 * of the screen, dragged up, could leave the camera level with the
 * pivot yet looking above the horizon — and OrbitControls would snap
 * it back on release. Both angles have to stay in range.
 */
export function viewPolarAngle(quaternion: Quaternion): number {
  const f = FORWARD.clone().applyQuaternion(quaternion);
  return Math.acos(Math.min(1, Math.max(-1, -f.y)));
}

const poseInRange = (pose: RigidPose, pivot: Vector3, min: number, max: number) =>
  inRange(polarAngleFromY(pose.position.clone().sub(pivot)), min, max) &&
  inRange(viewPolarAngle(pose.quaternion), min, max);

/**
 * One drag-move step: yaw the camera around `pivot` about world +Y, then
 * pitch it about the post-yaw local right axis, clamping so the resulting
 * polar angle (about `pivot`, from world +Y) stays within
 * [minPolarAngle, maxPolarAngle].
 *
 * Yawing about world +Y never changes the polar angle (rotation about Y
 * preserves both the Y component and the distance from the Y axis), so only
 * the pitch step needs clamping. Polar angle is only monotonic in the pitch
 * angle up to the pole (a local extremum) — a pitch big enough to sail past
 * it and back would otherwise read as "still in bounds" if only the
 * endpoint were checked, which would let a fast drag punch through the
 * ceiling and land back inside it. Pitch is therefore walked in small
 * substeps, each checked (and, on the substep that first goes out of
 * bounds, bisected and the walk stopped) — pinning the camera at the bound
 * instead of tunnelling past it, matching what a continuous drag would do.
 */
export function stepPivotOrbit(params: {
  position: Vector3;
  quaternion: Quaternion;
  pivot: Vector3;
  yaw: number;
  pitch: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}): PivotOrbitStepResult {
  const { position, quaternion, pivot, yaw, pitch, minPolarAngle, maxPolarAngle } = params;

  const yawed = rotateRigidAroundPivot({ position, quaternion }, pivot, WORLD_UP, yaw);
  const right = new Vector3(1, 0, 0).applyQuaternion(yawed.quaternion);

  if (Math.abs(pitch) < EPS) return { ...yawed, appliedPitch: 0 };

  const steps = Math.max(1, Math.ceil(Math.abs(pitch) / PITCH_SUBSTEP));
  const microAngle = pitch / steps;

  let pose: RigidPose = yawed;
  let appliedPitch = 0;
  for (let i = 0; i < steps; i++) {
    const candidate = rotateRigidAroundPivot(pose, pivot, right, microAngle);
    if (poseInRange(candidate, pivot, minPolarAngle, maxPolarAngle)) {
      pose = candidate;
      appliedPitch += microAngle;
      continue;
    }
    // This micro-step crosses the bound; bisect within just this tiny
    // interval (safe from the pole-crossing ambiguity above) and stop —
    // further pitch in the same direction stays pinned at the bound.
    let lo = 0;
    let hi = microAngle;
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2;
      const midPose = rotateRigidAroundPivot(pose, pivot, right, mid);
      if (poseInRange(midPose, pivot, minPolarAngle, maxPolarAngle)) lo = mid;
      else hi = mid;
    }
    pose = rotateRigidAroundPivot(pose, pivot, right, lo);
    appliedPitch += lo;
    break;
  }

  return { ...pose, appliedPitch };
}

/**
 * Where to park OrbitControls' `target` when handing the camera back to it
 * at the end of a pivot-orbit drag, with no visible jump: the point on the
 * camera's current forward axis at the same distance the pivot sits along
 * that axis. Because the target lands exactly on the view axis, re-aiming
 * the camera at it (what OrbitControls.update() does) doesn't move it.
 */
export function computeHandoffTarget(
  cameraPosition: Vector3,
  forward: Vector3,
  pivot: Vector3,
  minDistance = 1e-3,
): Vector3 {
  const f = forward.clone().normalize();
  const dist = Math.max(minDistance, pivot.clone().sub(cameraPosition).dot(f));
  return cameraPosition.clone().add(f.multiplyScalar(dist));
}
