import type { Device } from "@/lib/types";
import { physicalSizeCm } from "@/lib/display-math";
import { deviceViewScale } from "@/lib/view-scale";
import { centerYFor } from "@/lib/viewing-geometry";
import type { DisplayMode } from "@/stores/settings-store";
import type { Scenario } from "@/stores/viewer-store";
import { NAME_FONT_CM } from "./device-rect-helpers";
import type { LabelPlacement } from "./device-rect";

/**
 * Vertical fov that makes the head-on camera see exactly what the 2D view
 * shows in this window: the window height mapped through the 2D scale into
 * device pixels, then through the panel's pixel pitch into physical size,
 * subtended from the viewing distance. This is what makes the 2D↔3D swap
 * land without a visual jump.
 */
export function headOnFovDeg(
  thisDevice: Device,
  displayMode: DisplayMode,
  winW: number,
  winH: number,
): number {
  if (typeof window === "undefined" || winW <= 0 || winH <= 0) return 40;
  const res = thisDevice.resolution;
  const k = deviceViewScale(
    res.w,
    res.h,
    winW,
    winH,
    displayMode === "viewport" ? window.screen.width : null,
  );
  if (!k) return 40;
  const visibleDevicePx = winH / k;
  const { heightCm } = physicalSizeCm(thisDevice.diagonalIn, thisDevice.aspect);
  const physH = (visibleDevicePx / res.h) * heightCm;
  const fov =
    2 * Math.atan(physH / 2 / thisDevice.distanceCm) * (180 / Math.PI);
  return Math.min(120, Math.max(5, fov));
}

/**
 * Deterministic de-overlap for the per-device text labels. Devices with
 * similar sizes/distances (nested handhelds at 36/40cm) land their name and
 * floor-distance labels on top of each other; this walks the visible set
 * sorted by distance, chain-clusters anchors that fall within roughly a
 * label height of each other, and hands each member a stable offset:
 * names alternate to the left/right rect edge (like the 2D view's corner
 * cycling) and stack upward past pairs; floor labels alternate sides of the
 * drop line and stagger height. Pure and order-stable — recomputed only
 * when devices/scenario/eye height change, never per frame.
 */
export function computeLabelPlacements(
  visible: Device[],
  scenario: Scenario,
  eyeH: number,
): Map<string, LabelPlacement> {
  interface Info {
    id: string;
    z: number;
    topY: number;
    halfW: number;
    nameSize: number;
    /** Rough rendered width of the name, in scene cm. */
    nameW: number;
  }
  const infos: Info[] = visible
    .map((d) => {
      const { widthCm, heightCm } = physicalSizeCm(d.diagonalIn, d.aspect);
      const centerY = centerYFor(d, scenario, eyeH);
      return {
        id: d.id,
        z: d.distanceCm,
        // Name-label anchor height (rect top + 3), at the tween's target.
        topY: centerY + heightCm / 2 + 3,
        halfW: widthCm / 2,
        nameSize: NAME_FONT_CM,
        // Average glyph advance for this face is ~0.55em; close enough to
        // decide overlap without measuring troika's laid-out geometry.
        nameW: d.label.length * NAME_FONT_CM * 0.55,
      };
    })
    .sort((a, b) => a.z - b.z);

  const out = new Map<string, LabelPlacement>();
  for (const i of infos)
    out.set(i.id, { nameX: 0, nameLift: 0, distX: 0, distLift: 0 });

  // Name labels: anchors near each other in the (y, z) plane collide.
  // They separate by STACKING, not by sliding sideways. Parking a name
  // on its own rect edge (±halfW) scaled the offset with panel width, so
  // a 32:9 ultrawide threw its label ~60cm out — twice as far as a 16:9
  // neighbour and visibly detached from the screen it names. Height is
  // also the only stable axis here: every rect is centred on x=0, and
  // the horizontal offset was modulated by camera side, so it collapsed
  // to zero near edge-on and let the labels collide anyway. A lift is
  // applied statically, so the ladder holds through a full orbit.
  let cluster: Info[] = [];
  const GAP = 2;
  const flushNames = () => {
    if (cluster.length > 1) {
      // Need-based, like the floor-label ramp below: each name rises only
      // far enough to clear the one under it, then stops. A fixed
      // idx * step ladder compounded instead — a monitor whose rect
      // already sits well above the handhelds still inherited two rungs
      // of someone else's stack and floated away from its own screen.
      // Cluster is depth-sorted, so the ladder climbs away from the
      // viewer and each name stays centred over the rect it belongs to.
      let prevTop = -Infinity;
      for (const m of cluster) {
        const p = out.get(m.id)!;
        p.nameX = 0;
        // Labels anchor at their BOTTOM on topY, so one occupies
        // [topY + lift, topY + lift + nameSize].
        const lift = Math.max(0, prevTop + GAP - m.topY);
        p.nameLift = lift;
        prevTop = m.topY + lift + m.nameSize;
      }
    }
    cluster = [];
  };
  for (const info of infos) {
    const prev = cluster[cluster.length - 1];
    // Two names clash when their anchors are closer than the names are
    // WIDE — a multiple of font size missed that, so "Steam Deck OLED"
    // and "27″ 1440p Monitor" sat 28cm apart in z and still overlapped
    // by half their length. Every rect is centred on x=0, so the anchor
    // gap is all that keeps them apart.
    if (
      prev &&
      Math.hypot(info.z - prev.z, info.topY - prev.topY) >
        (prev.nameW + info.nameW) / 2
    ) {
      flushNames();
    }
    cluster.push(info);
  }
  flushNames();

  // Floor labels all sit ~5cm above the floor on their drop lines, so only
  // the distance separates them; a "360 cm" readout is ~18cm wide.
  // Floor labels: need-based ramp. Each label sums pairwise pressure
  // from neighbors within RANGE — zero when clear, growing linearly as
  // the gap closes. Nearer-than-neighbor pushes down (negative),
  // farther pushes up, so isolated labels sit exactly on their node
  // and crowded ones separate only as much as they must. The sign is
  // re-oriented per frame from the camera side (device-rect).
  const RANGE = 25;
  const MAX_LIFT = 4;
  for (const a of infos) {
    let need = 0;
    for (const b of infos) {
      if (a === b) continue;
      const gap = Math.abs(a.z - b.z);
      if (gap < RANGE) {
        need += (a.z < b.z ? -1 : 1) * (1 - gap / RANGE);
      }
    }
    const p = out.get(a.id)!;
    p.distX = 0;
    p.distLift = Math.max(-1.6, Math.min(1.6, need)) * MAX_LIFT;
  }

  return out;
}
