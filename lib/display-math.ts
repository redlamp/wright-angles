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

import type { Aspect, Device, Resolution } from "./types";

export const CM_PER_IN = 2.54;

export const inToCm = (v: number) => v * CM_PER_IN;
export const cmToIn = (v: number) => v / CM_PER_IN;

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

export const subtenseArcmin = (sizeCm: number, distanceCm: number) =>
  degToArcmin(subtenseDeg(sizeCm, distanceCm));

/** Inverse of subtense: how big (cm) to appear at `arcmin` from `distanceCm`. */
export function sizeForArcmin(arcmin: number, distanceCm: number): number {
  return 2 * distanceCm * Math.tan((arcmin / 60 / 2) / DEG_PER_RAD);
}

/** Full angular description of a device as seen by its viewer. */
export function deviceAngles(device: Device) {
  const { widthCm, heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  const hDeg = subtenseDeg(widthCm, device.distanceCm);
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

  const solve = (targetSizeCm: number) => {
    const thetaRad =
      2 * Math.atan(targetSizeCm / (2 * target.distanceCm));
    return 2 * host.distanceCm * Math.tan(thetaRad / 2);
  };

  const widthCmOnHost = solve(t.widthCm);
  const heightCmOnHost = solve(t.heightCm);
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
 * Human acuity reference points, in arc minutes.
 * 20/20 vision resolves ~1 arcmin of detail; comfortable body text is
 * usually quoted at 18–22 arcmin cap height, with ~15 as a floor for
 * critical text (the sheet flags console rows once they dip near 10–15).
 */
export const ACUITY = {
  detailLimitArcmin: 1,
  minCriticalTextArcmin: 15,
  comfortableTextArcmin: 20,
} as const;
