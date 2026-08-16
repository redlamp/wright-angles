"use client";

import { useEffect, useRef } from "react";
import { MathUtils, MeshBasicMaterial, type Group } from "three";
import { useFrame } from "@react-three/fiber";
import type { InputType, Scenario } from "@/stores/viewer-store";
import type { ScenePalette } from "./scene-palette";
import { SEAT_Y, STAND_DESK_TOP } from "./viewer-figure";

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
const STAND_MATS = makeMatSet();

/** Which furniture set a scenario × input combination calls for. */
export type FurnitureKind = "desk" | "couch" | "standdesk" | "none";

export function furnitureFor(
  scenario: Scenario,
  inputType: InputType,
): FurnitureKind {
  if (scenario === "desk") return "desk";
  if (scenario === "couch") return "couch";
  // Standing: mouse & keyboard needs a surface — a standing desk.
  return inputType === "keyboard" ? "standdesk" : "none";
}

/** Enter/exit progress per furniture set; 1 = fully shown. */
interface FurnitureProgress {
  desk: number;
  couch: number;
  standdesk: number;
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
  active: FurnitureKind,
  step: number,
  deskGroup: Group | null,
  couchGroup: Group | null,
  standGroup: Group | null,
): boolean {
  const prevDesk = progress.desk;
  const prevCouch = progress.couch;
  const prevStand = progress.standdesk;
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
  progress.standdesk = MathUtils.clamp(
    progress.standdesk + (active === "standdesk" ? step : -step),
    0,
    1,
  );
  applyFurniture(deskGroup, DESK_MATS, progress.desk);
  applyFurniture(couchGroup, COUCH_MATS, progress.couch);
  applyFurniture(standGroup, STAND_MATS, progress.standdesk);
  // Whether anything is still mid-transition (drives demand-frameloop).
  return (
    progress.desk !== prevDesk ||
    progress.couch !== prevCouch ||
    progress.standdesk !== prevStand
  );
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

/** Standing desk: tall top at STAND_DESK_TOP, no chair. */
function StandingDesk({ mats }: { mats: MatSet }) {
  const top = STAND_DESK_TOP;
  return (
    <group>
      <mesh material={mats.furniture} position={[0, top - 2, 58]}>
        <boxGeometry args={[130, 4, 62]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            material={mats.furniture}
            position={[sx * 58, (top - 4) / 2, 58 + sz * 26]}
          >
            <boxGeometry args={[5, top - 4, 5]} />
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
  inputType,
  palette,
}: {
  scenario: Scenario;
  inputType: InputType;
  palette: ScenePalette;
}) {
  useEffect(() => {
    for (const mats of [DESK_MATS, COUCH_MATS, STAND_MATS]) {
      mats.furniture.color.set(palette.furniture);
      mats.soft.color.set(palette.soft);
    }
  }, [palette]);

  const active = furnitureFor(scenario, inputType);
  const deskRef = useRef<Group>(null);
  const couchRef = useRef<Group>(null);
  const standRef = useRef<Group>(null);
  // Mount shows the current combination fully, no entrance animation.
  const progress = useRef<FurnitureProgress>({
    desk: active === "desk" ? 1 : 0,
    couch: active === "couch" ? 1 : 0,
    standdesk: active === "standdesk" ? 1 : 0,
  });

  useFrame((state, delta) => {
    // Demand frameloop: the first frame after idle carries a huge delta
    // (time since the last render), which would snap the crossfade to
    // its end in one step. Clamp to a normal frame's worth.
    const moving = stepFurniture(
      progress.current,
      active,
      Math.min(delta, 1 / 30) / TWEEN_S,
      deskRef.current,
      couchRef.current,
      standRef.current,
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
      <group ref={standRef}>
        <StandingDesk mats={STAND_MATS} />
      </group>
    </>
  );
}
