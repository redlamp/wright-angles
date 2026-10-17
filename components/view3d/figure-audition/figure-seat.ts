import { Vector3, type Bone, type Mesh, type Object3D, type SkinnedMesh } from "three";
import type { Scenario } from "@/stores/viewer-store";
import { SEAT_Y } from "../viewer-figure";
import { dominantBone } from "./figure-regions";
import { aim, legDir, worldPos, type Segment } from "./rig-math";

/** What the seat measurement needs of a rig. */
export interface SeatSource {
  outer: Object3D;
  meshes: { mesh: Mesh }[];
  segments: Map<Bone, Segment>;
  sides: Record<1 | -1, { upperLeg: Bone; lowerLeg: Bone }>;
}

const _v = new Vector3();
const _dir = new Vector3();
const _a = new Vector3();
const _b = new Vector3();

function updateSkins(rig: SeatSource) {
  rig.outer.updateMatrixWorld(true);
  for (const { mesh } of rig.meshes) {
    const sk = mesh as SkinnedMesh;
    if (sk.isSkinnedMesh) sk.skeleton.update();
  }
}

/**
 * Sit the rig (thighs forward) and find the underside of its thighs: the
 * lowest skinned vertex driven mostly by a thigh bone, as a drop below
 * the thigh joints in model units. Rigs put the thigh joint anywhere
 * from the femoral head to the crotch line, so a fixed joint-to-seat
 * offset left some bodies hovering. Call at build, in the rest pose.
 */
export function measureSeatDrop(rig: SeatSource): number {
  for (const side of [1, -1] as const) {
    const s = rig.sides[side];
    aim(rig.segments, s.upperLeg, s.lowerLeg, legDir(-Math.PI / 2, _dir), 1);
  }
  updateSkins(rig);
  const thighs = new Set<Bone>([rig.sides[1].upperLeg, rig.sides[-1].upperLeg]);
  const hipY = (worldPos(rig.sides[1].upperLeg, _a).y + worldPos(rig.sides[-1].upperLeg, _b).y) / 2;
  let minY = Infinity;
  for (const { mesh } of rig.meshes) {
    const sk = mesh as SkinnedMesh;
    if (!sk.isSkinnedMesh) continue;
    const n = sk.geometry.getAttribute("position").count;
    for (let i = 0; i < n; i++) {
      const bone = dominantBone(sk, i);
      if (!bone || !thighs.has(bone)) continue;
      sk.getVertexPosition(i, _v).applyMatrix4(sk.matrixWorld);
      if (_v.y < minY) minY = _v.y;
    }
  }
  return Number.isFinite(minY) ? hipY - minY : 0;
}

/** Where the furniture should move to meet a seated figure, world cm. */
export interface SeatOffset {
  /** Seat plane relative to the stance's nominal SEAT_Y. */
  dy: number;
  /** Hip joints relative to the origin the chair and sofa are placed around. */
  dz: number;
}

/**
 * The posed figure's seat: the thigh underside under its hip joints and
 * where those joints sit front to back. With the eyes locked to the eye
 * point, every model's hips land wherever its proportions put them, so
 * the chair and sofa follow instead (Taylor 2026-10-17). Standing has no
 * seat; the last value is kept.
 */
export function seatOffset(rig: SeatSource, seatDrop: number, scale: number, scenario: Scenario, out: SeatOffset): boolean {
  if (scenario === "standing") return false;
  worldPos(rig.sides[1].upperLeg, _a);
  worldPos(rig.sides[-1].upperLeg, _b);
  out.dy = (_a.y + _b.y) / 2 - seatDrop * scale - SEAT_Y[scenario];
  out.dz = (_a.z + _b.z) / 2;
  return true;
}
