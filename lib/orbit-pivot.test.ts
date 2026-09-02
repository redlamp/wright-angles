import { describe, expect, test } from "bun:test";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  computeHandoffTarget,
  polarAngleFromY,
  rotateRigidAroundPivot,
  stepPivotOrbit,
  viewPolarAngle,
} from "./orbit-pivot";

const HALF_PI = Math.PI / 2;

describe("polarAngleFromY", () => {
  test("straight up is 0", () => {
    expect(polarAngleFromY(new Vector3(0, 5, 0))).toBeCloseTo(0, 6);
  });
  test("straight down is π", () => {
    expect(polarAngleFromY(new Vector3(0, -5, 0))).toBeCloseTo(Math.PI, 6);
  });
  test("on the equator is π/2", () => {
    expect(polarAngleFromY(new Vector3(5, 0, 0))).toBeCloseTo(HALF_PI, 6);
    expect(polarAngleFromY(new Vector3(0, 0, -5))).toBeCloseTo(HALF_PI, 6);
  });
  test("degenerate (zero-length) offset is 0, not NaN", () => {
    expect(polarAngleFromY(new Vector3(0, 0, 0))).toBe(0);
  });
});

describe("rotateRigidAroundPivot", () => {
  test("yawing a camera 90° about +Y around a pivot moves its position onto the expected side", () => {
    // Camera at (0,0,10) looking at the world origin (pivot), i.e. -Z forward.
    const position = new Vector3(0, 0, 10);
    const quaternion = new Quaternion(); // identity: forward is -Z, right is +X
    const pivot = new Vector3(0, 0, 0);
    const { position: p2, quaternion: q2 } = rotateRigidAroundPivot(
      { position, quaternion },
      pivot,
      new Vector3(0, 1, 0),
      HALF_PI,
    );
    // Offset (0,0,10) rotated +90° about +Y -> (10,0,0) (right-hand rule).
    expect(p2.x).toBeCloseTo(10, 5);
    expect(p2.y).toBeCloseTo(0, 5);
    expect(p2.z).toBeCloseTo(0, 5);
    // Orientation turned the same 90°: forward (-Z rotated) -> -X.
    const forward = new Vector3(0, 0, -1).applyQuaternion(q2);
    expect(forward.x).toBeCloseTo(-1, 5);
    expect(forward.z).toBeCloseTo(0, 5);
  });

  test("zero angle is a no-op (returns clones, not the same instances)", () => {
    const position = new Vector3(1, 2, 3);
    const quaternion = new Quaternion(0.1, 0.2, 0.3, 0.9).normalize();
    const out = rotateRigidAroundPivot(
      { position, quaternion },
      new Vector3(),
      new Vector3(0, 1, 0),
      0,
    );
    expect(out.position.equals(position)).toBe(true);
    expect(out.position).not.toBe(position);
    expect(out.quaternion.equals(quaternion)).toBe(true);
  });

  test("a full 2π turn returns to the start", () => {
    const position = new Vector3(3, 4, 5);
    const quaternion = new Quaternion(0.2, -0.1, 0.05, 0.9).normalize();
    const pivot = new Vector3(-1, 2, 0);
    const out = rotateRigidAroundPivot(
      { position, quaternion },
      pivot,
      new Vector3(0, 1, 0),
      Math.PI * 2,
    );
    expect(out.position.distanceTo(position)).toBeLessThan(1e-4);
  });
});

describe("stepPivotOrbit", () => {
  const start = () => ({
    position: new Vector3(0, 0, 10),
    quaternion: new Quaternion(), // looking down -Z at the pivot below
    pivot: new Vector3(0, 0, 0),
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI - 0.05,
  });

  test("yaw alone never changes the polar angle", () => {
    const s = start();
    const before = polarAngleFromY(s.position.clone().sub(s.pivot));
    const out = stepPivotOrbit({ ...s, yaw: 1.234, pitch: 0 });
    const after = polarAngleFromY(out.position.clone().sub(s.pivot));
    expect(after).toBeCloseTo(before, 6);
    expect(out.appliedPitch).toBe(0);
  });

  test("a small pitch is applied in full when it stays within bounds", () => {
    const s = start();
    const out = stepPivotOrbit({ ...s, yaw: 0, pitch: 0.1 });
    expect(out.appliedPitch).toBeCloseTo(0.1, 6);
  });

  test("pitch is clamped so the polar angle never exceeds maxPolarAngle", () => {
    const s = start();
    // A big pitch (within the monotonic range — well short of swinging past
    // the pole) would otherwise overshoot the bound; it must stop there
    // instead of overshooting or being ignored outright.
    const out = stepPivotOrbit({ ...s, yaw: 0, pitch: 2 });
    const phi = polarAngleFromY(out.position.clone().sub(s.pivot));
    expect(phi).toBeLessThanOrEqual(s.maxPolarAngle + 1e-3);
    expect(Math.abs(out.appliedPitch)).toBeLessThan(2);
  });

  test("pitch is clamped so the polar angle never drops below minPolarAngle", () => {
    const s = start();
    const out = stepPivotOrbit({ ...s, yaw: 0, pitch: -2 });
    const phi = polarAngleFromY(out.position.clone().sub(s.pivot));
    expect(phi).toBeGreaterThanOrEqual(s.minPolarAngle - 1e-3);
  });

  test("repeated small pitches approach but do not cross maxPolarAngle", () => {
    let s = start();
    let phi = polarAngleFromY(s.position.clone().sub(s.pivot));
    for (let i = 0; i < 50; i++) {
      const out = stepPivotOrbit({ ...s, yaw: 0, pitch: 0.2 });
      phi = polarAngleFromY(out.position.clone().sub(s.pivot));
      expect(phi).toBeLessThanOrEqual(s.maxPolarAngle + 1e-3);
      s = { ...s, position: out.position, quaternion: out.quaternion };
    }
    expect(phi).toBeGreaterThan(s.maxPolarAngle - 0.01);
  });
});

describe("computeHandoffTarget", () => {
  test("lands on the camera's forward axis at the pivot's along-axis distance", () => {
    const cameraPosition = new Vector3(0, 0, 10);
    const forward = new Vector3(0, 0, -1); // looking toward -Z
    const pivot = new Vector3(5, 5, 3); // off-axis, 7 units along forward
    const target = computeHandoffTarget(cameraPosition, forward, pivot);
    // Distance along forward = (pivot - camera) . forward = (10-3) = 7.
    expect(target.distanceTo(cameraPosition)).toBeCloseTo(7, 5);
    // On the forward ray: target = camera + forward * 7.
    expect(target.x).toBeCloseTo(0, 5);
    expect(target.y).toBeCloseTo(0, 5);
    expect(target.z).toBeCloseTo(3, 5);
  });

  test("clamps to a minimum positive distance when the pivot is behind or at the camera", () => {
    const cameraPosition = new Vector3(0, 0, 0);
    const forward = new Vector3(0, 0, -1);
    const pivot = new Vector3(0, 0, 5); // behind the camera relative to forward
    const target = computeHandoffTarget(cameraPosition, forward, pivot, 0.5);
    expect(target.distanceTo(cameraPosition)).toBeCloseTo(0.5, 5);
  });
});

describe("stepPivotOrbit with an off-axis pivot", () => {
  // Camera above and behind the origin, looking slightly DOWN at a
  // point on its axis; the pivot (a click on the floor) sits below
  // that axis. This is the "click the floor near the bottom of the
  // screen and drag" case.
  const position = new Vector3(0, 5, 10);
  const quaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(position, new Vector3(0, 3, 0), new Vector3(0, 1, 0)),
  );
  const pivot = new Vector3(0, 0, 0);
  const min = 0.05;
  const max = HALF_PI - 0.05;

  test("the view direction stays inside OrbitControls' polar range in both pitch directions", () => {
    for (const pitch of [1.2, -1.2]) {
      const r = stepPivotOrbit({
        position, quaternion, pivot, yaw: 0, pitch,
        minPolarAngle: min, maxPolarAngle: max,
      });
      const view = viewPolarAngle(r.quaternion);
      expect(view).toBeGreaterThanOrEqual(min - 1e-6);
      expect(view).toBeLessThanOrEqual(max + 1e-6);
      const about = polarAngleFromY(r.position.clone().sub(pivot));
      expect(about).toBeGreaterThanOrEqual(min - 1e-6);
      expect(about).toBeLessThanOrEqual(max + 1e-6);
    }
  });

  test("the handoff target then reproduces the same polar angle for OrbitControls", () => {
    const r = stepPivotOrbit({
      position, quaternion, pivot, yaw: 0.3, pitch: -1.2,
      minPolarAngle: min, maxPolarAngle: max,
    });
    const forward = new Vector3(0, 0, -1).applyQuaternion(r.quaternion);
    const target = computeHandoffTarget(r.position, forward, pivot);
    const orbitPolar = polarAngleFromY(r.position.clone().sub(target));
    expect(orbitPolar).toBeCloseTo(viewPolarAngle(r.quaternion), 6);
    expect(orbitPolar).toBeLessThanOrEqual(max + 1e-6);
  });
});
