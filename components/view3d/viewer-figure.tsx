"use client";

import { MeshBasicMaterial } from "three";
import type { Scenario } from "@/stores/viewer-store";

/** Height the figure is authored at; the whole body scales by heightCm/175. */
const AUTHORED_CM = 175;

/** Seat heights baked into the viewer store's eyeHeightCm() constants. */
export const SEAT_Y: Record<Exclude<Scenario, "standing">, number> = {
  desk: 45,
  couch: 40,
};

const FIGURE_MAT = new MeshBasicMaterial({ color: "#b6b6b6" });

/**
 * Standing pose, authored at 175cm with eyes at 163.8 (= 0.936·175), so a
 * uniform scale lands the eye exactly on eyeHeightCm("standing", h).
 */
function Standing() {
  return (
    <group>
      <mesh material={FIGURE_MAT} position={[0, 164, 0]}>
        <sphereGeometry args={[10.5, 24, 16]} />
      </mesh>
      <mesh material={FIGURE_MAT} position={[0, 151, 0]}>
        <capsuleGeometry args={[3.5, 6, 4, 12]} />
      </mesh>
      <mesh material={FIGURE_MAT} position={[0, 122, 0]}>
        <capsuleGeometry args={[12.5, 28, 8, 16]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            material={FIGURE_MAT}
            position={[side * 18, 113, 0]}
            rotation={[0, 0, side * 0.1]}
          >
            <capsuleGeometry args={[4.5, 52, 4, 12]} />
          </mesh>
          <mesh material={FIGURE_MAT} position={[side * 7.5, 45, 0]}>
            <capsuleGeometry args={[6.5, 76, 4, 12]} />
          </mesh>
          <mesh material={FIGURE_MAT} position={[side * 7.5, 2.5, 5]}>
            <boxGeometry args={[9, 5, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Seated pose (hips bent 90°), authored with the seat plane at local y=0 and
 * eyes at 78.75 (= 0.45·175) above it, matching the store's seated formulas
 * once the group is lifted by the unscaled seat height. Lower legs are sized
 * against the real (world) seat height so the feet stay on the floor at any
 * body scale.
 */
function Seated({ seatY, s }: { seatY: number; s: number }) {
  const lowerTotal = seatY / s + 12; // local knee height down to the floor
  const lowerLen = Math.max(6, lowerTotal - 11);
  const footY = (2.5 - seatY) / s;
  return (
    <group>
      <mesh material={FIGURE_MAT} position={[0, 10, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[10, 8, 4, 12]} />
      </mesh>
      <mesh material={FIGURE_MAT} position={[0, 38, -1]}>
        <capsuleGeometry args={[12.5, 28, 8, 16]} />
      </mesh>
      <mesh material={FIGURE_MAT} position={[0, 67, 0]}>
        <capsuleGeometry args={[3.5, 6, 4, 12]} />
      </mesh>
      <mesh material={FIGURE_MAT} position={[0, 79, 1.5]}>
        <sphereGeometry args={[10.5, 24, 16]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            material={FIGURE_MAT}
            position={[side * 18, 40, 8]}
            rotation={[-0.3, 0, side * 0.1]}
          >
            <capsuleGeometry args={[4.5, 38, 4, 12]} />
          </mesh>
          <mesh
            material={FIGURE_MAT}
            position={[side * 7.5, 12, 19]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <capsuleGeometry args={[6.5, 26, 4, 12]} />
          </mesh>
          <mesh
            material={FIGURE_MAT}
            position={[side * 7.5, 12 - lowerTotal / 2, 38]}
          >
            <capsuleGeometry args={[5.5, lowerLen, 4, 12]} />
          </mesh>
          <mesh material={FIGURE_MAT} position={[side * 7.5, footY, 44]}>
            <boxGeometry args={[9, 5, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Stylized low-poly human at the origin facing +Z. Unlit on purpose — the
 * scene has no lighting rig.
 */
export default function ViewerFigure({
  scenario,
  heightCm,
}: {
  scenario: Scenario;
  heightCm: number;
}) {
  const s = heightCm / AUTHORED_CM;
  if (scenario === "standing") {
    return (
      <group scale={s}>
        <Standing />
      </group>
    );
  }
  const seatY = SEAT_Y[scenario];
  return (
    <group position={[0, seatY, 0]} scale={s}>
      <Seated seatY={seatY} s={s} />
    </group>
  );
}
