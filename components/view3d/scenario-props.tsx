"use client";

import { MeshBasicMaterial } from "three";
import type { Scenario } from "@/stores/viewer-store";
import { SEAT_Y } from "./viewer-figure";

// Dark neutrals a step above the ground plane, well below the figure gray,
// so props read as context without competing with device key colors.
const FURNITURE_MAT = new MeshBasicMaterial({ color: "#4b4b4b" });
const SOFT_MAT = new MeshBasicMaterial({ color: "#464646" });

/** Desk chair with its seat top at SEAT_Y.desk; backrest behind the figure. */
function DeskChair() {
  const seatTop = SEAT_Y.desk;
  return (
    <group>
      <mesh material={SOFT_MAT} position={[0, seatTop - 2, 3]}>
        <boxGeometry args={[46, 4, 46]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            material={FURNITURE_MAT}
            position={[sx * 19, (seatTop - 4) / 2, 3 + sz * 19]}
          >
            <boxGeometry args={[4, seatTop - 4, 4]} />
          </mesh>
        )),
      )}
      <mesh material={SOFT_MAT} position={[0, seatTop + 21, -17]}>
        <boxGeometry args={[44, 38, 4]} />
      </mesh>
    </group>
  );
}

function Desk() {
  return (
    <group>
      <mesh material={FURNITURE_MAT} position={[0, 72, 62]}>
        <boxGeometry args={[150, 4, 70]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            material={FURNITURE_MAT}
            position={[sx * 68, 35, 62 + sz * 30]}
          >
            <boxGeometry args={[5, 70, 5]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Low couch with its seat top at SEAT_Y.couch. */
function Couch() {
  const seatTop = SEAT_Y.couch;
  return (
    <group>
      <mesh material={SOFT_MAT} position={[0, seatTop / 2, 2]}>
        <boxGeometry args={[110, seatTop, 60]} />
      </mesh>
      <mesh material={SOFT_MAT} position={[0, seatTop + 15, -30]}>
        <boxGeometry args={[110, 40, 14]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={SOFT_MAT} position={[side * 62, seatTop + 5, -1]}>
          <boxGeometry args={[14, 22, 72]} />
        </mesh>
      ))}
    </group>
  );
}

/** Furniture context for the current scenario; nothing when standing. */
export default function ScenarioProps({ scenario }: { scenario: Scenario }) {
  if (scenario === "desk") {
    return (
      <group>
        <DeskChair />
        <Desk />
      </group>
    );
  }
  if (scenario === "couch") return <Couch />;
  return null;
}
