/**
 * Where a rigged figure's hands go and how they sit, per stance and
 * input. Pure numbers; world space, centimeters, the figure facing +Z
 * with its left side on +X. The capsule figure's symmetric wrists were
 * tuned for its slab hands; a real figure needs the left hand on WASD,
 * the right on a mouse, and palms that face what they touch.
 */

import type { InputType, Scenario } from "@/stores/viewer-store";
import type { HeldGrip } from "@/lib/viewing-geometry";

/** A stance: the body's scenario and what the hands hold. */
export type Stance = { scenario: Scenario; input: InputType };
import { SEAT_Y, STAND_DESK_TOP } from "../viewer-figure";

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface HandPlan {
  /** Wrist target, world cm. */
  target: V3;
  /** Elbow bend hint, world direction. */
  pole: V3;
  /** Direction the fingers point, world. */
  fingers: V3;
  /** Direction the palm faces, world. */
  palm: V3;
  /** How far the fingers and the thumb close toward the palm, degrees. */
  curl: { fingers: number; thumb: number };
}

export interface HandsPlan {
  left: HandPlan;
  right: HandPlan;
  /** Head pitches down toward the hands (a handheld in them). */
  lookAtHands: boolean;
  /** Degrees the shoulder tips drop from the rest pose's shrug. */
  shoulderDropDeg: number;
}

/**
 * Torso posture per stance, degrees about the lateral axis (positive
 * pitches forward/down). The pelvis tips back when seated, the spine
 * leans in at a desk and reclines on a couch, and the head counters so
 * the gaze stays on the line of sight.
 */
export const POSTURE: Record<Scenario, Posture> = {
  standing: { pelvis: 0, spine: 0, head: 0 },
  desk: { pelvis: -6, spine: 12, head: -6 },
  couch: { pelvis: -12, spine: -4, head: 16 },
};

/** Most the head pitches down to a handheld in the hands. */
export const HANDHELD_LOOK_MAX_DEG = 40;

/** Elbows down and clearly out from the ribs: arms that hang like arms. */
const ELBOW = { x: 0.9, y: -0.8, z: -0.3 };
/** Controller hold: elbows out and back, forearms meeting in front. */
const ELBOW_TUCKED = { x: 0.7, y: -0.9, z: -0.55 };
/**
 * Handheld: how far outside heldGripFor's half span the rig's wrist sits.
 * That span is the chassis edge less a 2 cm inset (for the capsule
 * figure's slab hands); a wrist belongs about 1 cm outside the edge, so
 * the hand wraps the grip instead of lying across the screen.
 */
const HANDHELD_WRIST_OUTBOARD_CM = 3;
/** And a little below heldGripFor's wrist height: the grips hang under the controls. */
const HANDHELD_WRIST_DROP_CM = 3;
/** Handheld raised in front: elbows down and a little out. */
const ELBOW_RAISED = { x: 0.6, y: -1, z: -0.3 };

/** Desk top height per stance (world cm); the couch keyboard sits on the lap. */
function surfaceY(scenario: Scenario): number {
  if (scenario === "desk") return 74;
  if (scenario === "standing") return STAND_DESK_TOP;
  return SEAT_Y.couch + 13;
}

/**
 * Wrist height above a surface the fingers rest on: the wrist joint
 * sits a hand's thickness up, and the fingers slope down from there.
 */
const WRIST_ABOVE_SURFACE = 2;
/** Near edge of the keyboard (center z 40, 19 cm deep) and of the mouse (center z 37, 12 cm long); see scenario-props Peripherals. */
const KEYBOARD_NEAR_Z = 30;
const MOUSE_NEAR_Z = 31;
/**
 * Keyboard center x and mouse center x (world cm, +x is the figure's
 * left). Together they put the left hand on WASD and the right on the
 * mouse about equally either side of the body, so neither arm reaches
 * across; the mouse clears the keyboard's right edge by a hand's width.
 */
export const KEYBOARD_X = 11;
export const MOUSE_X = -24;

/** Mirror a plan's x components for the other hand. */
const mirror = (p: HandPlan): HandPlan => ({
  target: { ...p.target, x: -p.target.x },
  pole: { ...p.pole, x: -p.pole.x },
  fingers: { ...p.fingers, x: -p.fingers.x },
  palm: { ...p.palm, x: -p.palm.x },
  curl: { ...p.curl },
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V3, b: V3, t: number): V3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
const lerpHand = (a: HandPlan, b: HandPlan, t: number): HandPlan => ({
  target: lerpV(a.target, b.target, t),
  pole: lerpV(a.pole, b.pole, t),
  fingers: lerpV(a.fingers, b.fingers, t),
  palm: lerpV(a.palm, b.palm, t),
  curl: { fingers: lerp(a.curl.fingers, b.curl.fingers, t), thumb: lerp(a.curl.thumb, b.curl.thumb, t) },
});

/** Blended hands plan: everything numeric lerps, the look-down becomes a weight. */
export interface HandsBlend {
  left: HandPlan;
  right: HandPlan;
  /** 0..1 weight of the head pitching down to the hands. */
  lookAtHands: number;
  shoulderDropDeg: number;
}

export function lerpHands(a: HandsPlan, b: HandsPlan, t: number): HandsBlend {
  return {
    left: lerpHand(a.left, b.left, t),
    right: lerpHand(a.right, b.right, t),
    lookAtHands: lerp(a.lookAtHands ? 1 : 0, b.lookAtHands ? 1 : 0, t),
    shoulderDropDeg: lerp(a.shoulderDropDeg, b.shoulderDropDeg, t),
  };
}

export type Posture = { pelvis: number; spine: number; head: number };

export const lerpPosture = (a: Posture, b: Posture, t: number): Posture => ({
  pelvis: lerp(a.pelvis, b.pelvis, t),
  spine: lerp(a.spine, b.spine, t),
  head: lerp(a.head, b.head, t),
});

/**
 * @param rootY world height of the pelvis root
 * @param s figure scale (height / 175)
 */
/**
 * Hands check: both arms forward at chest height, shoulder width apart,
 * palms down, fingers straight, so a close camera sees both hands and
 * how they flow into the forearms. Not a scenario; a dev view.
 */
export function planHandsCheck(rootY: number, s: number): HandsPlan {
  const left: HandPlan = {
    target: { x: 17 * s, y: rootY + 50 * s, z: 34 * s },
    pole: ELBOW,
    fingers: { x: 0, y: -0.05, z: 1 },
    palm: { x: 0, y: -1, z: 0 },
    curl: { fingers: 0, thumb: 0 },
  };
  return { left, right: mirror(left), lookAtHands: false, shoulderDropDeg: 9 };
}

/** This frame's hands: the check view when on, else the stance tween (held plans at t >= 1 settle on the target). */
export function frameHands(check: "off" | "t" | "hands", from: Stance, to: Stance, t: number, rootY: number, s: number, held: HeldGrip | null): HandsBlend {
  if (check === "hands") {
    const p = planHandsCheck(rootY, s);
    return lerpHands(p, p, 1);
  }
  const b = planHands(to.scenario, to.input, rootY, s, held);
  return t >= 1 ? lerpHands(b, b, 1) : lerpHands(planHands(from.scenario, from.input, rootY, s, held), b, t);
}

export function planHands(
  scenario: Scenario,
  input: InputType,
  rootY: number,
  s: number,
  held: HeldGrip | null,
): HandsPlan {
  if (input === "keyboard") {
    // Wrists rest on the desk just short of the keyboard and mouse (their
    // near edges: keyboard center z 40 and 19 deep, mouse center z 37 and
    // 12 long), the heel of the hand on the surface, the hand tilted up a
    // little so it lies on top of the keys and the mouse body; a light
    // curl drops the fingertips onto them. On the couch the keyboard is
    // on the lap, so the wrists sit a hand's width closer.
    const y = surfaceY(scenario) + WRIST_ABOVE_SURFACE * s;
    const desk = scenario !== "couch";
    const left: HandPlan = {
      target: { x: (KEYBOARD_X + 10) * s, y, z: (desk ? KEYBOARD_NEAR_Z : 18) * s },
      pole: ELBOW,
      fingers: { x: -0.1, y: 0.12, z: 1 },
      palm: { x: 0, y: -1, z: 0.25 },
      curl: { fingers: 25, thumb: 10 },
    };
    const right: HandPlan = {
      target: { x: MOUSE_X * s, y: y + 0.5 * s, z: (desk ? MOUSE_NEAR_Z : 18) * s },
      pole: ELBOW,
      fingers: { x: 0.05, y: 0.1, z: 1 },
      palm: { x: 0, y: -1, z: 0.25 },
      curl: { fingers: 35, thumb: 15 },
    };
    return { left, right, lookAtHands: false, shoulderDropDeg: 9 };
  }

  if (input === "gamepad") {
    // Controller held low in front of the belly: hands a grip apart,
    // palms facing each other and tilted up, fingers wrapping down and
    // around the grips (which angle down and forward), thumbs up on
    // the sticks.
    const left: HandPlan = {
      target: { x: 9 * s, y: rootY + 23 * s, z: 22 * s },
      pole: ELBOW_TUCKED,
      fingers: { x: -0.3, y: -0.55, z: 1 },
      palm: { x: -1, y: 0.55, z: -0.25 },
      curl: { fingers: 75, thumb: 20 },
    };
    return { left, right: mirror(left), lookAtHands: false, shoulderDropDeg: 8 };
  }

  // Handheld: hold the device in the scene by its grips. Handhelds carry
  // their sticks and buttons outboard of the screen, so the heel of the
  // hand sits on the chassis edge with the wrist outside it, the fingers
  // wrap behind, and the thumb reaches the controls inboard without
  // covering the display. held.halfGripCm is the chassis half width less
  // the capsule figure's inset; the rig's wrist goes back out past it.
  const grip = (x: number, y: number, z: number): HandPlan => ({
    target: { x, y, z },
    pole: ELBOW_RAISED,
    // Hand axis mostly up along the grip, a touch inward and behind.
    fingers: { x: -0.2, y: 0.9, z: 0.35 },
    palm: { x: -1, y: 0.1, z: 0.25 },
    curl: { fingers: 60, thumb: 15 },
  });
  const left = held
    ? grip(held.halfGripCm + HANDHELD_WRIST_OUTBOARD_CM * s, held.wristY - HANDHELD_WRIST_DROP_CM * s, held.distanceCm)
    : grip((12 + HANDHELD_WRIST_OUTBOARD_CM) * s, rootY + (56 - HANDHELD_WRIST_DROP_CM) * s, 2 * s + 32);
  // The head keeps its gaze on the display: the device sits in the sight
  // line anyway, and pitching toward the hands made the head bob through
  // the tween (Taylor 2026-10-17).
  return { left, right: mirror(left), lookAtHands: false, shoulderDropDeg: 2 };
}
