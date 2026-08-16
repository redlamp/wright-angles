"use client";

import { useEffect, useMemo, useRef } from "react";
import { MathUtils, MeshStandardMaterial, Vector3, type Group, type Mesh } from "three";
import { useFrame } from "@react-three/fiber";
import type { Scenario } from "@/stores/viewer-store";
import type { ScenePalette } from "./scene-palette";

/** Height the figure is authored at; the whole body scales by heightCm/175. */
const AUTHORED_CM = 175;

/** Seat heights baked into the viewer store's eyeHeightCm() constants. */
export const SEAT_Y: Record<Exclude<Scenario, "standing">, number> = {
  desk: 45,
  couch: 40,
};

// Lit (unlike everything else in the scene) so the capsules and boxes
// shade and their forms read; the figure lights in scene-view exist
// solely for this material. Smooth shading on purpose — Taylor rejected
// the faceted look (2026-08-15): "more accurate and generic".
const FIGURE_MAT = new MeshStandardMaterial({
  color: "#b6b6b6",
  roughness: 0.9,
  metalness: 0,
});

// Rig constants, authored cm relative to the pelvis center (rig root).
// Root-local eyes sit at +69, so rootY = eyeHeight − 69·s for any pose.
const HIP_X = 7.5;
const HIP_Y = -3;
const THIGH = 44; // hip→knee joint span
const SHOULDER_X = 17;
// Acromion sits ~21cm below the eyes (root-local 69) on a 175cm frame —
// aligned with the torso capsule's shoulder dome, not its mid-cylinder.
const SHOULDER_Y = 47;
const UPPER = 26; // shoulder→elbow
const FORE = 22; // elbow→wrist

const TWEEN_S = 0.5;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * A pose is pure numbers so scenario transitions can lerp it. rootY/scale
 * are world units; everything else is root-local authored cm. Wrist/pole
 * are for the right arm; x mirrors for the left.
 */
interface Pose {
  scale: number;
  rootY: number;
  torsoZ: number;
  headZ: number;
  /** Thigh rotation.x: 0 = hanging, -π/2 = forward (seated). */
  hipRot: number;
  /** Lower-leg rotation.x relative to the thigh. */
  kneeRot: number;
  /** Knee→ankle span; stretched so the feet land on the floor. */
  lowerLen: number;
  /** IK wrist target. */
  wrist: Vec3Like;
  /** Elbow bend direction hint. */
  pole: Vec3Like;
}

/**
 * Eye-height contract (matches the viewer store): standing eyes at 164·s ≈
 * 0.936·H; seated eyes at seat + 79·s ≈ seat + 0.45·H, with the pelvis 10cm
 * above the seat plane.
 */
function makePose(scenario: Scenario, heightCm: number): Pose {
  const s = heightCm / AUTHORED_CM;
  if (scenario === "standing") {
    const rootY = 95 * s;
    return {
      scale: s,
      rootY,
      torsoZ: 0,
      headZ: 0,
      hipRot: 0,
      kneeRot: 0,
      // Straight leg down: hip − thigh − lowerLen lands the ankle at 4cm.
      lowerLen: rootY / s + HIP_Y - THIGH - 4, // = 44
      // Hangs just short of full arm length from the raised shoulder.
      wrist: { x: 19, y: -1, z: 2 },
      pole: { x: 0.3, y: -0.2, z: -1 },
    };
  }
  const seatY = SEAT_Y[scenario];
  const rootY = seatY + 10 * s;
  // Thigh forward, lower leg vertical: ankle lands at ~4cm (foot height).
  const lowerLen = MathUtils.clamp(rootY / s - 7, 20, 60);
  if (scenario === "desk") {
    // Hands forward over the keyboard: desk top is at world y=74.
    return {
      scale: s,
      rootY,
      torsoZ: 0,
      headZ: 0,
      hipRot: -Math.PI / 2,
      kneeRot: Math.PI / 2,
      lowerLen,
      wrist: { x: 9, y: (77 - rootY) / s, z: 38 / s },
      pole: { x: 0.1, y: -1, z: -0.3 },
    };
  }
  // Couch: relaxed handheld hold. Elbows drop to the sides (pole mostly
  // -y), hands a bit apart at the device's grips, ~13cm below the eye line
  // and ~32cm out, so the forearms rake up toward the screen ~40° from
  // vertical — the natural Switch/Deck angle. The device rect itself stays
  // upright and on the sight line: tilting it would contradict the
  // face-on angular math the readouts are built on.
  return {
    scale: s,
    rootY,
    torsoZ: -1,
    headZ: 1.5,
    hipRot: -Math.PI / 2,
    kneeRot: Math.PI / 2,
    lowerLen,
    wrist: { x: 5.5, y: 56, z: 2 + 32 / s },
    pole: { x: 0.5, y: -1, z: -0.3 },
  };
}

const lerp = MathUtils.lerp;
const lerpV = (a: Vec3Like, b: Vec3Like, t: number): Vec3Like => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    scale: lerp(a.scale, b.scale, t),
    rootY: lerp(a.rootY, b.rootY, t),
    torsoZ: lerp(a.torsoZ, b.torsoZ, t),
    headZ: lerp(a.headZ, b.headZ, t),
    hipRot: lerp(a.hipRot, b.hipRot, t),
    kneeRot: lerp(a.kneeRot, b.kneeRot, t),
    lowerLen: lerp(a.lowerLen, b.lowerLen, t),
    wrist: lerpV(a.wrist, b.wrist, t),
    pole: lerpV(a.pole, b.pole, t),
  };
}

interface SideRefs {
  hip: Group | null;
  knee: Group | null;
  lower: Mesh | null;
  foot: Group | null;
  upper: Mesh | null;
  fore: Mesh | null;
  hand: Mesh | null;
}

const newSide = (): SideRefs => ({
  hip: null,
  knee: null,
  lower: null,
  foot: null,
  upper: null,
  fore: null,
  hand: null,
});

// useFrame scratch, allocated once.
const UP = new Vector3(0, 1, 0);
const vS = new Vector3();
const vT = new Vector3();
const vD = new Vector3();
const vP = new Vector3();
const vE = new Vector3();
const vSeg = new Vector3();

/** Analytic 2-bone IK: place upper arm, forearm, and hand for one side. */
function applyArm(side: 1 | -1, pose: Pose, r: SideRefs) {
  if (!r.upper || !r.fore || !r.hand) return;
  vS.set(side * SHOULDER_X, SHOULDER_Y, 0);
  vT.set(side * pose.wrist.x, pose.wrist.y, pose.wrist.z);
  vD.subVectors(vT, vS);
  const d = MathUtils.clamp(vD.length(), 8, UPPER + FORE - 0.5);
  vD.normalize();
  vT.copy(vS).addScaledVector(vD, d);
  const cosA = MathUtils.clamp(
    (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d),
    -1,
    1,
  );
  const a = Math.acos(cosA);
  vP.set(side * pose.pole.x, pose.pole.y, pose.pole.z);
  vP.addScaledVector(vD, -vP.dot(vD));
  if (vP.lengthSq() < 1e-6) vP.set(0, 0, -1).addScaledVector(vD, vD.z);
  vP.normalize();
  vE.copy(vS)
    .addScaledVector(vD, Math.cos(a) * UPPER)
    .addScaledVector(vP, Math.sin(a) * UPPER);

  vSeg.subVectors(vE, vS).normalize();
  r.upper.position.addVectors(vS, vE).multiplyScalar(0.5);
  r.upper.quaternion.setFromUnitVectors(UP, vSeg);
  vSeg.subVectors(vT, vE).normalize();
  r.fore.position.addVectors(vE, vT).multiplyScalar(0.5);
  r.fore.quaternion.setFromUnitVectors(UP, vSeg);
  r.hand.position.copy(vT).addScaledVector(vSeg, 3.5);
  r.hand.quaternion.copy(r.fore.quaternion);
}

function applyPose(
  pose: Pose,
  root: Group,
  torso: Mesh,
  head: Mesh,
  sides: Record<1 | -1, SideRefs>,
) {
  root.scale.setScalar(pose.scale);
  root.position.y = pose.rootY;
  torso.position.z = pose.torsoZ;
  head.position.z = pose.headZ;
  for (const side of [-1, 1] as const) {
    const r = sides[side];
    if (r.hip) r.hip.rotation.x = pose.hipRot;
    if (r.knee) r.knee.rotation.x = pose.kneeRot;
    if (r.lower) {
      r.lower.scale.y = pose.lowerLen;
      r.lower.position.y = -pose.lowerLen / 2;
    }
    if (r.foot) r.foot.position.y = -pose.lowerLen;
    applyArm(side, pose, r);
  }
}

/**
 * Stylized low-poly human at the origin facing +Z, lit by the figure-only
 * lights in scene-view. Posed imperatively in useFrame so scenario
 * changes tween (~0.5s ease in-out) instead of snapping.
 */
export default function ViewerFigure({
  scenario,
  heightCm,
  palette,
}: {
  scenario: Scenario;
  heightCm: number;
  palette: ScenePalette;
}) {
  useEffect(() => {
    FIGURE_MAT.color.set(palette.figure);
  }, [palette]);

  const target = useMemo(() => makePose(scenario, heightCm), [scenario, heightCm]);

  const rootRef = useRef<Group>(null);
  const torsoRef = useRef<Mesh>(null);
  const headRef = useRef<Mesh>(null);
  const sides = useRef<Record<1 | -1, SideRefs>>({ [-1]: newSide(), [1]: newSide() });

  const cur = useRef<Pose>(target);
  const anim = useRef<{ from: Pose; start: number | null } | null>(null);
  const prevTarget = useRef(target);
  useEffect(() => {
    if (prevTarget.current !== target) {
      anim.current = { from: cur.current, start: null };
      prevTarget.current = target;
    }
  }, [target]);

  useFrame((state) => {
    const a = anim.current;
    if (a) {
      if (a.start === null) a.start = state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - a.start) / TWEEN_S);
      cur.current = t >= 1 ? target : lerpPose(a.from, target, easeInOutCubic(t));
      if (t >= 1) anim.current = null;
      // Keep frames coming while tweening (demand frameloop).
      state.invalidate();
    }
    if (rootRef.current && torsoRef.current && headRef.current) {
      applyPose(cur.current, rootRef.current, torsoRef.current, headRef.current, sides.current);
    }
  });

  return (
    <group ref={rootRef}>
      <mesh material={FIGURE_MAT} position={[0, 2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[9, 8, 4, 12]} />
      </mesh>
      <mesh ref={torsoRef} material={FIGURE_MAT} position={[0, 27, 0]}>
        <capsuleGeometry args={[12.5, 28, 8, 16]} />
      </mesh>
      <mesh material={FIGURE_MAT} position={[0, 56, 0]}>
        <capsuleGeometry args={[3.5, 6, 4, 12]} />
      </mesh>
      <mesh ref={headRef} material={FIGURE_MAT} position={[0, 69, 0]}>
        <sphereGeometry args={[10.5, 24, 16]} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <group
            ref={(o) => {
              sides.current[side].hip = o;
            }}
            position={[side * HIP_X, HIP_Y, 0]}
          >
            <mesh material={FIGURE_MAT} position={[0, -THIGH / 2, 0]}>
              <capsuleGeometry args={[6.5, THIGH - 13, 4, 12]} />
            </mesh>
            <group
              ref={(o) => {
                sides.current[side].knee = o;
              }}
              position={[0, -THIGH, 0]}
            >
              {/* Unit-height cylinder; scale.y carries the pose's lowerLen. */}
              <mesh
                ref={(o) => {
                  sides.current[side].lower = o;
                }}
                material={FIGURE_MAT}
              >
                <cylinderGeometry args={[5.5, 4.5, 1, 10]} />
              </mesh>
              <group
                ref={(o) => {
                  sides.current[side].foot = o;
                }}
              >
                <mesh material={FIGURE_MAT} position={[0, -2, 4.5]}>
                  <boxGeometry args={[9, 5, 16]} />
                </mesh>
              </group>
            </group>
          </group>
          {/* Arm segments are free meshes; IK places them each frame. */}
          <mesh
            ref={(o) => {
              sides.current[side].upper = o;
            }}
            material={FIGURE_MAT}
          >
            <capsuleGeometry args={[4.5, UPPER - 9, 4, 12]} />
          </mesh>
          <mesh
            ref={(o) => {
              sides.current[side].fore = o;
            }}
            material={FIGURE_MAT}
          >
            <capsuleGeometry args={[4, FORE - 8, 4, 12]} />
          </mesh>
          <mesh
            ref={(o) => {
              sides.current[side].hand = o;
            }}
            material={FIGURE_MAT}
          >
            <boxGeometry args={[7, 3.5, 9]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
