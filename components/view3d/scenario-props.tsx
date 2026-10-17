"use client";

import { useEffect, useMemo, useRef } from "react";
import { MathUtils, MeshBasicMaterial, type Group } from "three";
import { useFrame } from "@react-three/fiber";
import { tweenStep } from "@/lib/motion";
import { useReducedMotion } from "@/components/use-reduced-motion";
import type { InputType, Scenario } from "@/stores/viewer-store";
import type { ScenePalette } from "./scene-palette";
import { SEAT_Y, STAND_DESK_TOP } from "./viewer-figure";
import { FirefliesProp, KenneyProp, materialsOf, type PropTint } from "./furniture-models";

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
  // glTF pieces and the peripherals carry their own materials.
  for (const m of materialsOf(group)) {
    if (m === mats.furniture || m === mats.soft) continue;
    if (!m.transparent) m.transparent = true;
    m.opacity = e;
  }
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

/** World height of the desk top (cm); hands and peripherals sit on it. */
export const DESK_TOP = 74;
/** 150 x 60: IKEA's common desk top (LINNMON, LAGKAPTEN); MICKE is 50, BEKANT 80. */
const DESK_W = 150;
const DESK_D = 60;
/** Near edge sits just in front of the seated figure's knees. */
const DESK_NEAR_Z = 27;

/** Kenney office chair, scaled so its seat lands near SEAT_Y.desk. */
function DeskChair({ tint }: { tint: PropTint }) {
  const k = 190;
  // Measured in the kit: the seat and back are one node centered at
  // x 0.167, z -0.16 (back at -z), so that point goes under the hips.
  // The figure's hip joints are at the origin and the thighs run to +z;
  // a hip sits a hand's width in front of the seat back, so the seat
  // center lands 8 cm ahead of the hips.
  const seatX = 0.167 * k;
  const seatZ = -0.16 * k;
  return <KenneyProp name="chairDesk" scale={k} position={[-seatX, 0, 8 - seatZ]} tint={tint} />;
}

/**
 * The desk stays the plain slab on four thin legs: open underneath, so
 * the figure's knees have room, and it never argues with the device
 * panels. (A Kenney desk with a drawer pedestal was tried 2026-10-17 and
 * rejected: backwards, legs clipping.)
 */
function Desk({ mats, inputType }: { mats: MatSet; inputType: InputType }) {
  return (
    <group>
      <mesh material={mats.furniture} position={[0, DESK_TOP - 2, DESK_NEAR_Z + DESK_D / 2]}>
        <boxGeometry args={[DESK_W, 4, DESK_D]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            material={mats.furniture}
            position={[sx * (DESK_W / 2 - 7), (DESK_TOP - 4) / 2, DESK_NEAR_Z + DESK_D / 2 + sz * (DESK_D / 2 - 5)]}
          >
            <boxGeometry args={[5, DESK_TOP - 4, 5]} />
          </mesh>
        )),
      )}
      <Peripherals top={DESK_TOP} show={inputType === "keyboard"} />
    </group>
  );
}

/**
 * Keyboard and mouse where the rigged figure's hands land: WASD under
 * the left hand, the mouse out to the right (the figure's right is -X).
 * Kenney keyboard 0.282 x 0.118 with its origin at a corner; mouse
 * 0.05 x 0.085, origin at its front center.
 */
/**
 * Fireflies keyboard (44 cm, full size) and mouse at real size. The
 * keyboard centers 3 cm left of the figure so WASD lands under the left
 * hand (x 13) and the mouse sits under the right (x -24) with a couple of
 * centimeters between them, as on a real desk.
 */
function Peripherals({ top, show }: { top: number; show: boolean }) {
  return (
    <group visible={show}>
      {/* As exported: space bar toward -z (the user); the mouse's buttons
          face -z too, so it turns around to point away. */}
      <FirefliesProp name="keyboard" position={[3, top, 40]} />
      <FirefliesProp name="mouse" position={[-24, top, 37]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

/** Standing desk: tall top at STAND_DESK_TOP, no chair. */
function StandingDesk({ mats, inputType }: { mats: MatSet; inputType: InputType }) {
  const top = STAND_DESK_TOP;
  return (
    <group>
      <Peripherals top={top} show={inputType === "keyboard"} />
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

/**
 * Kenney lounge sofa: seat at 0.23 units, 0.98 wide, origin at its front
 * left corner with the back at -z. 174 puts the seat at SEAT_Y.couch.
 */
function Couch({ tint }: { tint: PropTint }) {
  const k = SEAT_Y.couch / 0.23;
  return <KenneyProp name="loungeSofa" scale={k} position={[-0.49 * k, 0, 0.41 * k - 28]} tint={tint} />;
}

/**
 * Furniture context for the current scenario; nothing when standing. Both
 * sets stay mounted; scenario changes animate them (~0.5s, synced to the
 * figure's pose tween): the incoming set rises from the floor and fades in
 * while the outgoing one sinks and fades out, driven imperatively in
 * useFrame — no setState, groups hidden entirely once fully out.
 */
/**
 * Ctrl+drag orbit pivots on a piece of furniture at its BOTTOM-CENTRE,
 * not the clicked spot on a cushion (see pivot-orbit.tsx).
 */
const ORBIT_BASE = { orbitPivot: "base" } as const;

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

  const reduced = useReducedMotion();
  const active = furnitureFor(scenario, inputType);
  const tint = useMemo<PropTint>(
    () => ({ furniture: palette.furniture, soft: palette.soft }),
    [palette.furniture, palette.soft],
  );
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
    // its end in one step. tweenStep clamps it to a normal frame's worth
    // (or, with reduced motion, deliberately snaps).
    const moving = stepFurniture(
      progress.current,
      active,
      tweenStep(delta, TWEEN_S, reduced),
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
      <group ref={deskRef} userData={ORBIT_BASE}>
        <DeskChair tint={tint} />
        <Desk mats={DESK_MATS} inputType={inputType} />
      </group>
      <group ref={couchRef} userData={ORBIT_BASE}>
        <Couch tint={tint} />
      </group>
      <group ref={standRef} userData={ORBIT_BASE}>
        <StandingDesk mats={STAND_MATS} inputType={inputType} />
      </group>
    </>
  );
}
