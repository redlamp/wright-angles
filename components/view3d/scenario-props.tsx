"use client";

import { useEffect, useRef } from "react";
import { MathUtils, MeshBasicMaterial, type Group } from "three";
import { useFrame } from "@react-three/fiber";
import type { Scenario } from "@/stores/viewer-store";
import type { ScenePalette } from "./scene-palette";
import { SEAT_Y } from "./viewer-figure";

/** Matches the viewer figure's pose tween so furniture moves in sync. */
const TWEEN_S = 0.5;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Neutrals near the ground plane, well below the figure gray, so props read
// as context without competing with device key colors. Colors come from the
// scene palette; the materials are retinted when the theme flips. Each
// furniture set gets its OWN pair (transparent, for the enter/exit fade) so
// the outgoing set can fade out while the incoming one fades in.
interface MatSet {
  furniture: MeshBasicMaterial;
  soft: MeshBasicMaterial;
}
const makeMatSet = (): MatSet => ({
  furniture: new MeshBasicMaterial({ color: "#4b4b4b", transparent: true }),
  soft: new MeshBasicMaterial({ color: "#464646", transparent: true }),
});
const DESK_MATS = makeMatSet();
const COUCH_MATS = makeMatSet();

/** Enter/exit progress per furniture set; 1 = fully shown. */
interface FurnitureProgress {
  desk: number;
  couch: number;
}

/**
 * Module-level mutators (react-compiler lint forbids property assignment on
 * hook-returned objects inside components).
 *
 * A set's eased progress drives a rise-from-the-floor scale plus a fade.
 * Progress ramps linearly in time and is eased here, so retargeting
 * mid-flight (rapid scenario flips) continues smoothly from wherever the
 * set currently is.
 */
function applyFurniture(group: Group | null, mats: MatSet, p: number) {
  if (!group) return;
  const e = easeInOutCubic(p);
  group.visible = p > 1e-3;
  group.scale.y = Math.max(1e-3, e);
  mats.furniture.opacity = e;
  mats.soft.opacity = e;
}

function stepFurniture(
  progress: FurnitureProgress,
  active: Scenario,
  step: number,
  deskGroup: Group | null,
  couchGroup: Group | null,
): boolean {
  const prevDesk = progress.desk;
  const prevCouch = progress.couch;
  progress.desk = MathUtils.clamp(
    progress.desk + (active === "desk" ? step : -step),
    0,
    1,
  );
  progress.couch = MathUtils.clamp(
    progress.couch + (active === "couch" ? step : -step),
    0,
    1,
  );
  applyFurniture(deskGroup, DESK_MATS, progress.desk);
  applyFurniture(couchGroup, COUCH_MATS, progress.couch);
  // Whether anything is still mid-transition (drives demand-frameloop).
  return progress.desk !== prevDesk || progress.couch !== prevCouch;
}

/** Desk chair with its seat top at SEAT_Y.desk; backrest behind the figure. */
function DeskChair({ mats }: { mats: MatSet }) {
  const seatTop = SEAT_Y.desk;
  return (
    <group>
      <mesh material={mats.soft} position={[0, seatTop - 2, 3]}>
        <boxGeometry args={[46, 4, 46]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            material={mats.furniture}
            position={[sx * 19, (seatTop - 4) / 2, 3 + sz * 19]}
          >
            <boxGeometry args={[4, seatTop - 4, 4]} />
          </mesh>
        )),
      )}
      <mesh material={mats.soft} position={[0, seatTop + 21, -17]}>
        <boxGeometry args={[44, 38, 4]} />
      </mesh>
    </group>
  );
}

function Desk({ mats }: { mats: MatSet }) {
  return (
    <group>
      <mesh material={mats.furniture} position={[0, 72, 62]}>
        <boxGeometry args={[150, 4, 70]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            material={mats.furniture}
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
function Couch({ mats }: { mats: MatSet }) {
  const seatTop = SEAT_Y.couch;
  return (
    <group>
      <mesh material={mats.soft} position={[0, seatTop / 2, 2]}>
        <boxGeometry args={[110, seatTop, 60]} />
      </mesh>
      <mesh material={mats.soft} position={[0, seatTop + 15, -30]}>
        <boxGeometry args={[110, 40, 14]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={mats.soft} position={[side * 62, seatTop + 5, -1]}>
          <boxGeometry args={[14, 22, 72]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Furniture context for the current scenario; nothing when standing. Both
 * sets stay mounted; scenario changes animate them (~0.5s, synced to the
 * figure's pose tween): the incoming set rises from the floor and fades in
 * while the outgoing one sinks and fades out, driven imperatively in
 * useFrame — no setState, groups hidden entirely once fully out.
 */
export default function ScenarioProps({
  scenario,
  palette,
}: {
  scenario: Scenario;
  palette: ScenePalette;
}) {
  useEffect(() => {
    DESK_MATS.furniture.color.set(palette.furniture);
    COUCH_MATS.furniture.color.set(palette.furniture);
    DESK_MATS.soft.color.set(palette.soft);
    COUCH_MATS.soft.color.set(palette.soft);
  }, [palette]);

  const deskRef = useRef<Group>(null);
  const couchRef = useRef<Group>(null);
  // Mount shows the current scenario fully, no entrance animation.
  const progress = useRef<FurnitureProgress>({
    desk: scenario === "desk" ? 1 : 0,
    couch: scenario === "couch" ? 1 : 0,
  });

  useFrame((state, delta) => {
    const moving = stepFurniture(
      progress.current,
      scenario,
      delta / TWEEN_S,
      deskRef.current,
      couchRef.current,
    );
    // Keep frames coming while the crossfade runs (demand frameloop).
    if (moving) state.invalidate();
  });

  return (
    // Visibility/scale/opacity are owned by applyFurniture; the first
    // useFrame runs before the first paint, so nothing flashes on mount.
    <>
      <group ref={deskRef}>
        <DeskChair mats={DESK_MATS} />
        <Desk mats={DESK_MATS} />
      </group>
      <group ref={couchRef}>
        <Couch mats={COUCH_MATS} />
      </group>
    </>
  );
}
