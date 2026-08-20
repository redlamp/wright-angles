/**
 * Display geometry and angular-size math.
 *
 * Arc minutes are the rosetta stone of Wright Angles: every display, image,
 * and piece of text is ultimately measured as the angle it subtends at the
 * viewer's eye. Two things that subtend the same angle look the same size,
 * regardless of which panel they're on. Everything else here is conversion
 * to and from that unit.
 *
 * Reference: Taylor's Disco Elysium font-sizing sheet (wiki/research/
 * arc-minute-spreadsheet.md) — the numbers in display-math.test.ts are
 * pinned to it.
 */

import { fitModeOf, fitScale } from "./fit";
import type { Aspect, Device, LengthUnit, Resolution } from "./types";

export const CM_PER_IN = 2.54;

export const inToCm = (v: number) => v * CM_PER_IN;
export const cmToIn = (v: number) => v / CM_PER_IN;

/**
 * Human-readable viewing distance in the chosen unit (Taylor
 * 2026-08-17): whole centimeters, or imperial as feet-and-inches from
 * one foot up (6′ 7″) and plain inches in half-inch steps below a foot
 * (9.5″). Inch remainders round whole and carry into the foot count at
 * 12, so 35.8 in reads 3′ 0″, never 2′ 12″.
 */
export function formatDistance(distanceCm: number, unit: LengthUnit): string {
  if (unit === "cm") return `${Math.round(distanceCm)} cm`;
  const totalIn = cmToIn(distanceCm);
  if (totalIn < 12) {
    const half = Math.round(totalIn * 2) / 2;
    return `${half % 1 === 0 ? half.toFixed(0) : half.toFixed(1)}″`;
  }
  let ft = Math.floor(totalIn / 12);
  let rem = Math.round(totalIn - ft * 12);
  if (rem === 12) {
    ft += 1;
    rem = 0;
  }
  return `${ft}′ ${rem}″`;
}

/**
 * Perceptual (log) mapping between a viewing distance and a 0..1
 * slider position. A linear 10..400cm track spends most of its length
 * on far distances where a centimeter barely matters; log spacing
 * gives handheld/desk distances the same room as TV/projector ones.
 * Distances outside [min, max] clamp to the track ends.
 */
export function distToSlider(cm: number, min: number, max: number): number {
  const t = Math.log(cm / min) / Math.log(max / min);
  return Math.min(1, Math.max(0, t));
}

/** Inverse of {@link distToSlider}: slider position t∈[0,1] → cm. */
export function sliderToDist(t: number, min: number, max: number): number {
  return min * Math.pow(max / min, t);
}

const DEG_PER_RAD = 180 / Math.PI;

/**
 * Reduce a resolution to its aspect ratio, e.g. 2560×1440 → 16:9.
 * Prefers the conventional display form where it differs from the pure
 * reduction (8:5 is always spoken of as 16:10).
 */
export function aspectFromResolution(res: Resolution): Aspect {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(res.w, res.h) || 1;
  const reduced = { w: res.w / g, h: res.h / g };
  const conventional: Record<string, Aspect> = {
    "8:5": { w: 16, h: 10 },
  };
  return conventional[`${reduced.w}:${reduced.h}`] ?? reduced;
}

/** Physical panel size in cm from diagonal (inches) and aspect ratio. */
export function physicalSizeCm(diagonalIn: number, aspect: Aspect) {
  const r = aspect.w / aspect.h;
  const diagCm = inToCm(diagonalIn);
  const heightCm = diagCm / Math.sqrt(r * r + 1);
  return { widthCm: heightCm * r, heightCm };
}

/** Pixels per inch along the diagonal (the spec-sheet PPI). */
export function ppi(diagonalIn: number, res: Resolution): number {
  return Math.hypot(res.w, res.h) / diagonalIn;
}

/**
 * Angle subtended at the eye by a length seen face-on, centered on the line
 * of sight: 2·atan(size / 2·distance). Returns degrees.
 */
export function subtenseDeg(sizeCm: number, distanceCm: number): number {
  if (distanceCm <= 0) return 0;
  return 2 * Math.atan(sizeCm / (2 * distanceCm)) * DEG_PER_RAD;
}

export const degToArcmin = (deg: number) => deg * 60;

/**
 * Horizontal subtense of a curved panel wrapping a cylinder of radius R,
 * viewer on the panel's axis of symmetry. The physical width is the arc
 * length; the edges sit at chord = R·sin(w/2R), pulled sagitta =
 * R·(1−cos(w/2R)) closer to the viewer. For a 49″ 1000R panel at desk
 * distance this is a real difference, not a rounding error.
 */
export function curvedSubtenseDeg(
  arcWidthCm: number,
  distanceCm: number,
  curvatureRadiusCm?: number,
): number {
  if (!curvatureRadiusCm || curvatureRadiusCm <= 0) {
    return subtenseDeg(arcWidthCm, distanceCm);
  }
  const R = curvatureRadiusCm;
  const half = arcWidthCm / (2 * R);
  const chordHalf = R * Math.sin(half);
  const sagitta = R * (1 - Math.cos(half));
  const z = Math.max(1e-6, distanceCm - sagitta);
  return 2 * Math.atan(chordHalf / z) * DEG_PER_RAD;
}

export const subtenseArcmin = (sizeCm: number, distanceCm: number) =>
  degToArcmin(subtenseDeg(sizeCm, distanceCm));

/** Inverse of subtense: how big (cm) to appear at `arcmin` from `distanceCm`. */
export function sizeForArcmin(arcmin: number, distanceCm: number): number {
  return 2 * distanceCm * Math.tan((arcmin / 60 / 2) / DEG_PER_RAD);
}

/** Full angular description of a device as seen by its viewer. */
export function deviceAngles(device: Device) {
  const { widthCm, heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  const hDeg = curvedSubtenseDeg(
    widthCm,
    device.distanceCm,
    device.curvatureR ? device.curvatureR / 10 : undefined,
  );
  const vDeg = subtenseDeg(heightCm, device.distanceCm);
  const diagDeg = subtenseDeg(inToCm(device.diagonalIn), device.distanceCm);
  return {
    widthCm,
    heightCm,
    horizontalDeg: hDeg,
    verticalDeg: vDeg,
    diagonalDeg: diagDeg,
    horizontalArcmin: degToArcmin(hDeg),
    verticalArcmin: degToArcmin(vDeg),
    diagonalArcmin: degToArcmin(diagDeg),
    /** Pixels per degree of horizontal field — the acuity-relevant density. */
    ppd: hDeg > 0 ? device.resolution.w / hDeg : 0,
    /** Arc minutes covered by a single pixel (vertical, for font math). */
    arcminPerPx:
      device.resolution.h > 0
        ? degToArcmin(vDeg) / device.resolution.h
        : 0,
    ppi: ppi(device.diagonalIn, device.resolution),
  };
}

/**
 * Angular size of a feature `px` device-pixels tall on `device`, seen from
 * that device's viewing distance. This is the font-legibility number: the
 * sheet's 22px caps on a Switch Lite at 36cm → ~20 arcmin.
 *
 * Uses the physical pixel pitch and the exact subtense (not a linear share
 * of the screen's total angle), matching the spreadsheet.
 */
export function pixelsToArcmin(px: number, device: Device): number {
  const { heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  const pitchCm = heightCm / device.resolution.h;
  return subtenseArcmin(px * pitchCm, device.distanceCm);
}

/** Physical height (mm) of `px` device-pixels on `device`'s panel. */
export function pixelsToMm(px: number, device: Device): number {
  const { heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  return (px * heightCm * 10) / device.resolution.h;
}

/**
 * The core simulation: how many pixels OF THE HOST PANEL does `target`'s
 * screen occupy, if the host renders it at equal angular size?
 *
 * We match angles exactly: target subtends θ at its own viewer distance;
 * we solve for the physical size on the host panel that subtends the same
 * θ at the host's viewer distance, then convert through the host's pixel
 * pitch. For small angles this approaches the intuitive
 * (targetSize · hostDistance / targetDistance) / hostPitch.
 *
 * Returned in HOST DEVICE PIXELS. The view layer divides by
 * devicePixelRatio to get CSS pixels.
 */
export function simulatedSizeOnHostPx(target: Device, host: Device) {
  const t = physicalSizeCm(target.diagonalIn, target.aspect);
  const h = physicalSizeCm(host.diagonalIn, host.aspect);

  const solve = (thetaDeg: number) =>
    2 * host.distanceCm * Math.tan((thetaDeg / DEG_PER_RAD) / 2);

  // Width honors the target's curvature; height treats the panel as flat
  // (vertical curvature is negligible on real displays).
  const widthCmOnHost = solve(
    curvedSubtenseDeg(
      t.widthCm,
      target.distanceCm,
      target.curvatureR ? target.curvatureR / 10 : undefined,
    ),
  );
  const heightCmOnHost = solve(subtenseDeg(t.heightCm, target.distanceCm));
  const pitchW = h.widthCm / host.resolution.w;
  const pitchH = h.heightCm / host.resolution.h;

  return {
    widthPx: widthCmOnHost / pitchW,
    heightPx: heightCmOnHost / pitchH,
    widthCmOnHost,
    heightCmOnHost,
  };
}

/**
 * Scale factor for drawing an image authored at `referenceHeight` (e.g. a
 * 1080p capture) as target-device content inside the host's simulation
 * rect: image pixels → host device pixels.
 */
export function imageScaleOnHost(
  referenceHeight: number,
  target: Device,
  host: Device,
): number {
  if (referenceHeight <= 0) return 1;
  const sim = simulatedSizeOnHostPx(target, host);
  return sim.heightPx / referenceHeight;
}

/**
 * Apparent-size ratio between two viewing situations: how wide `target`
 * looks to its viewer relative to how wide `host` looks to its viewer.
 * 0.45 means "appears at 45% of the host's apparent width".
 */
export function apparentWidthRatio(target: Device, host: Device): number {
  const h = deviceAngles(host).horizontalDeg;
  return h > 0 ? deviceAngles(target).horizontalDeg / h : 0;
}

/**
 * Angular size of a feature authored `px` tall at `referenceHeight`
 * (e.g. 24px in a 1080p HUD) when that content runs fullscreen on
 * `device` — the "will my font ship legible" number.
 */
export function contentPxToArcmin(
  px: number,
  referenceHeight: number,
  device: Device,
): number {
  if (referenceHeight <= 0) return 0;
  return pixelsToArcmin(
    (px * device.resolution.h) / referenceHeight,
    device,
  );
}

/**
 * Angular height of a highlight box (normalized height `nh` of a media
 * item shown fullscreen on `device`), plus its size in the media's own
 * source pixels.
 *
 * The media→panel scale follows the DEVICE's fit mode (`device.fit`,
 * absent = contain): a fill-width panel matches the widths, a
 * fill-height panel the heights. Without this the reported arc minutes
 * would contradict what is drawn — this is the one place the math cares
 * about fit (decision-media-crop-vs-device-fit).
 *
 * A `stretch` panel has no single scale; `fitScale` hands back its
 * VERTICAL one, which is the figure this function wants anyway — `nh`
 * is a normalized HEIGHT and the whole px→mm→arcmin chain is height-
 * based. The arc minutes are therefore true for the text's height, and
 * the UI flags stretched devices so nobody reads them as width.
 *
 * `media` may be the source-cropped OR the fit-cropped dims: a fill
 * mode never touches the axis its own scale depends on (and stretch
 * crops nothing at all), so the answer is the same either way.
 */
export function boxMetricsOnDevice(
  nh: number,
  media: { width: number; height: number },
  device: Device,
) {
  // Fit the media into the device's pixel grid the way this panel does.
  const scale = fitScale(
    fitModeOf(device),
    media.width,
    media.height,
    device.resolution.w,
    device.resolution.h,
  );
  const devicePx = nh * media.height * scale;
  return {
    devicePx,
    arcmin: pixelsToArcmin(devicePx, device),
    mm: pixelsToMm(devicePx, device),
  };
}

/**
 * Human acuity reference points, in arc minutes.
 * 20/20 vision resolves ~1 arcmin of detail; comfortable body text is
 * usually quoted at 18–22 arcmin cap height, with ~15 as a floor for
 * critical text (the sheet flags console rows once they dip near 10–15).
 */
export const ACUITY = {
  detailLimitArcmin: 1,
  /** ISO 9241-303 clause 5.5 minimum character height. */
  minCriticalTextArcmin: 16,
  /** ISO 9241-303 required capability band (20–22′). */
  comfortableTextArcmin: 20,
} as const;

/**
 * Typical text stroke width ≈ cap height / 7 (regular-weight faces run
 * roughly 1/6–1/8). Strokes rendered below the 1′ acuity limit vanish
 * even when the letterforms technically fit — the sub-acuity warning
 * (plan 10.4).
 */
export const STROKE_PER_CAP = 1 / 7;

/** True when text of this cap-height angular size has sub-1′ strokes. */
export function strokesSubAcuity(capArcmin: number): boolean {
  return capArcmin * STROKE_PER_CAP < ACUITY.detailLimitArcmin;
}
