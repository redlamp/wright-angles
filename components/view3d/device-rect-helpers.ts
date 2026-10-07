import {
  BufferAttribute,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Group,
  type Material,
  type Object3D,
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useAnnotationStore, type DeviceHover } from "@/stores/annotation-store";

export const SHOW_LABELS = true;

/** Module-level mutator (react-compiler convention): 3D hover state. */
export const setDeviceHover = (h: DeviceHover | null) =>
  useAnnotationStore.getState().setDeviceHover(h);

export const _projCorner = new Vector3();

/**
 * Screen bounds (client px) of a hovered box's catcher plane: its four
 * local corners through the mesh's world matrix and the camera, mapped
 * into the canvas's client rect — so the hover card can position
 * itself OUTSIDE the box in either view.
 */
export function projectBounds(
  e: ThreeEvent<PointerEvent>,
  w: number,
  h: number,
  object: Object3D = e.object,
): { left: number; top: number; right: number; bottom: number } {
  const canvas = e.nativeEvent.target as HTMLElement;
  const r = canvas.getBoundingClientRect();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [cx, cy] of [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [-w / 2, h / 2],
    [w / 2, h / 2],
  ]) {
    _projCorner
      .set(cx, cy, 0)
      .applyMatrix4(object.matrixWorld)
      .project(e.camera);
    const x = r.left + ((_projCorner.x + 1) / 2) * r.width;
    const y = r.top + ((1 - _projCorner.y) / 2) * r.height;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}

/**
 * Barlow Medium for the 3D labels, matching the app's primary typeface.
 * troika-three-text can't read the CSS-registered @fontsource faces (or
 * .woff2), so a static .woff copy ships in public/fonts (see its README).
 */
export const FONT_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/barlow-latin-500-normal.woff`;

/** Matches the viewer figure's pose tween so stance changes move in sync. */
export const TWEEN_S = 0.5;

/**
 * Module-level mutator (react-compiler lint forbids property assignment on
 * hook-returned objects inside components). Places everything that depends
 * on the animated center height: the rect group itself, the drop-line group
 * (a unit line anchored at the rect bottom whose scale.y is the drop length
 * to the floor), and the floor label 5cm above the floor.
 */
/**
 * Rect-bottom → floor span for the drop line's scale.y. The epsilon keeps
 * the matrix invertible when the rect bottom sits exactly on the floor;
 * sign is preserved so a below-floor bottom draws upward.
 */
export function dropLen(y: number, heightCm: number): number {
  const len = y - heightCm / 2;
  return Math.abs(len) < 1e-3 ? 1e-3 : len;
}

/**
 * Rewrite the 4 eye→corner rays in the rect's local space, extended
 * THROUGH the corners out to `reachZ` (world distance) so the cone
 * visibly lands on the farthest display.
 *
 * The rays are overlay-drawn (no depth test), so anything they cross
 * gets painted over — including the figure's head, which the eye
 * point sits inside. Each ray therefore STARTS just outside the
 * head's surface instead of at the eye: seen THROUGH the head is fine,
 * entering its space is not (Taylor 2026-08-19). The figure's cranium
 * is a 10.5 cm sphere about the eye point (viewer-figure), so its
 * radius plus a hair of margin is the clearance.
 */
export const HEAD_CLEAR_CM = 11.5;

export function updateProjection(
  geom: BufferGeometry | null,
  eye: [number, number, number],
  corners: [number, number, number][],
  distCm: number,
  reachZ: number,
) {
  if (!geom) return;
  let attr = geom.getAttribute("position") as BufferAttribute | undefined;
  if (!attr || attr.count !== corners.length * 2) {
    attr = new BufferAttribute(new Float32Array(corners.length * 2 * 3), 3);
    geom.setAttribute("position", attr);
  }
  const a = attr.array as Float32Array;
  corners.forEach((c, i) => {
    const dirX = c[0] - eye[0];
    const dirY = c[1] - eye[1];
    const dirZ = c[2] - eye[2];
    // Local z of the eye is -distCm; scale the ray so its end lands on
    // the reachZ plane (world) = reachZ - distCm (local).
    const k = dirZ > 1e-6 ? reachZ / dirZ : 1;
    // Start offset in ray-parameter units (1 = the corner). Capped at
    // half the eye→corner run so a handheld at 36 cm keeps a visible
    // segment rather than losing it all to the clearance.
    const len = Math.hypot(dirX, dirY, dirZ);
    const s = len > 1e-6 ? Math.min(HEAD_CLEAR_CM / len, 0.5) : 0;
    const o = i * 6;
    a[o] = eye[0] + dirX * s;
    a[o + 1] = eye[1] + dirY * s;
    a[o + 2] = eye[2] + dirZ * s;
    a[o + 3] = eye[0] + dirX * k;
    a[o + 4] = eye[1] + dirY * k;
    a[o + 5] = eye[2] + dirZ * k;
  });
  attr.needsUpdate = true;
}

/**
 * Camera-aware de-collision. The base offsets assume "farther projects
 * screen-right"; this measures the actual on-screen direction of the
 * depth axis each frame by projecting two points of the sight line,
 * and scales the offset by it. Viewing from the other side of the
 * human flips the factor (labels invert); edge-on it passes through
 * zero, so the swap is always a glide. Module-level temps avoid
 * per-frame allocation.
 */
export const _projA = new Vector3();
export const _projB = new Vector3();
export function applyLabelLift(
  group: Group | null,
  baseLift: number,
  camera: Camera,
  deviceZ: number,
) {
  if (!group) return;
  _projA.set(0, 1.2, deviceZ).project(camera);
  _projB.set(0, 1.2, deviceZ + 40).project(camera);
  // Steep tanh: hold ~full separation until within a few degrees of
  // edge-on, then swap quickly — the sign must flip somewhere, but the
  // window where labels approach each other stays tiny.
  const f = Math.tanh((_projB.x - _projA.x) * 40);
  group.position.y = baseLift * f;
}

/**
 * Drag-affordance cursor for the distance handles. Set on the body (not
 * the canvas) so the fist survives a captured drag wandering over HUD
 * elements; empty string restores the default.
 */
export function setBodyCursor(cursor: string) {
  document.body.style.cursor = cursor;
}

/**
 * Distance labels draw over scene geometry (feet, furniture, even the
 * floor) — they're readouts, not objects in the room. Applied via the
 * Text's onSync so it survives troika re-syncs (label changes, outline
 * settings), which rebuild materials AFTER a mount effect would have
 * run; the traverse also catches the outline sub-mesh.
 */
export function raiseLabel(text: Object3D, order: number) {
  text.traverse((o) => {
    o.renderOrder = order;
    const m = (o as { material?: Material | Material[] }).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) mat.depthTest = false;
  });
}
export const raiseDistLabel = (text: Object3D) => raiseLabel(text, 20);
/** Name labels ride just under the distance readouts. */
export const raiseNameLabel = (text: Object3D) => raiseLabel(text, 15);

/**
 * Same camera-side modulation as the distance labels, applied to the
 * NAME label's horizontal de-collision offset: nested rects park their
 * names on alternating rect edges, and flipping the side with the
 * viewing direction keeps "nearer name outward" true from both sides
 * of the scene instead of crossing over.
 */
export function applyNameOffset(
  group: Group | null,
  baseX: number,
  camera: Camera,
  deviceZ: number,
) {
  if (!group) return;
  _projA.set(0, 1.2, deviceZ).project(camera);
  _projB.set(0, 1.2, deviceZ + 40).project(camera);
  group.position.x = baseX * Math.tanh((_projB.x - _projA.x) * 40);
}

export function applyCenterY(
  rect: Group | null,
  drop: Group | null,
  label: Group | null,
  y: number,
  heightCm: number,
) {
  if (rect) rect.position.y = y;
  if (drop) drop.scale.y = dropLen(y, heightCm);
  // The floor marker (node + flat angled label) sits on the ground.
  if (label) label.position.y = -y + 0.12;
}

/**
 * Outline loop for a content-space rect on the screen surface. The
 * shared texture is U-mirrored (the viewer at -Z sees back faces), so
 * content-left lands at local +x; curved panels bend the horizontal
 * edges along the same chord math as the screen itself, on a slightly
 * viewer-side radius so the lines never z-fight the content.
 */
export function boxLoopPoints(
  rect: { x: number; y: number; w: number; h: number },
  fitW: number,
  fitH: number,
  R: number,
): [number, number, number][] {
  const yTop = fitH / 2 - rect.y * fitH;
  const yBot = yTop - rect.h * fitH;
  const xAt = (fImg: number) => fitW / 2 - fImg * fitW;
  if (!R) {
    const x0 = xAt(rect.x + rect.w);
    const x1 = xAt(rect.x);
    const z = -0.3;
    return [
      [x0, yTop, z],
      [x1, yTop, z],
      [x1, yBot, z],
      [x0, yBot, z],
      [x0, yTop, z],
    ];
  }
  const r = R - 0.5;
  const arc = fitW / r;
  const at = (fImg: number, y: number): [number, number, number] => {
    const u = xAt(fImg) / fitW; // -0.5..0.5 across the arc
    return [r * Math.sin(arc * u), y, -R + r * Math.cos(arc * u)];
  };
  const N = 8;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= N; i++)
    pts.push(at(rect.x + (rect.w * i) / N, yTop));
  for (let i = 0; i <= N; i++)
    pts.push(at(rect.x + rect.w - (rect.w * i) / N, yBot));
  pts.push(at(rect.x, yTop));
  return pts;
}

/**
 * Device name labels are one size for every screen, in scene units (1 =
 * 1cm). They used to scale with the rect (`heightCm * 0.14`, clamped
 * 4–12) so a handheld wouldn't drown in text, but that made the name a
 * second, competing readout of how big the panel is — a 120″ projector
 * shouted while a Switch whispered, and the labels stopped reading as
 * one set. They are chrome, not scenery (see `raiseNameLabel`: no depth
 * test, drawn over the room), so they get one type size like any other
 * UI text. Shared with `computeLabelPlacements`, which sizes the
 * de-collision stack from it.
 */
export const NAME_FONT_CM = 7;
