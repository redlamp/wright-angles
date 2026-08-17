"use client";

import type { CvdMode } from "@/stores/settings-store";

/**
 * Color-vision-deficiency simulation (plan 10.5), fully local: SVG
 * feColorMatrix filters applied to the view layers via CSS
 * `filter: url(#...)`. Matrices are Machado, Oliveira & Fernandes
 * (2009) at severity 1.0 — the standard simulation matrices — applied
 * in linearRGB (the SVG filter default), which is the space they are
 * defined in. Achromatopsia is the Rec. 709 luminance projection.
 */

const MATRICES: Record<Exclude<CvdMode, "none">, number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281, 0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501, 0.047413,
    -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779,
    -0.078411, 0.930809, 0.147602,
    0.004733, 0.691367, 0.3039,
  ],
  achromatopsia: [
    0.2126, 0.7152, 0.0722,
    0.2126, 0.7152, 0.0722,
    0.2126, 0.7152, 0.0722,
  ],
};

/** 3×3 color matrix → the feColorMatrix 4×5 values string. */
const toValues = (m: number[]) =>
  [
    [m[0], m[1], m[2], 0, 0],
    [m[3], m[4], m[5], 0, 0],
    [m[6], m[7], m[8], 0, 0],
    [0, 0, 0, 1, 0],
  ]
    .flat()
    .join(" ");

export const CVD_CHOICES: { mode: CvdMode; label: string }[] = [
  { mode: "none", label: "Off" },
  { mode: "protanopia", label: "Protanopia (no red cones)" },
  { mode: "deuteranopia", label: "Deuteranopia (no green cones)" },
  { mode: "tritanopia", label: "Tritanopia (no blue cones)" },
  { mode: "achromatopsia", label: "Achromatopsia (no color)" },
];

/** CSS filter value for a mode; undefined for "none". */
export const cvdFilter = (mode: CvdMode) =>
  mode === "none" ? undefined : `url(#cvd-${mode})`;

/** Invisible filter definitions; mount once near the app root. */
export function CvdFilters() {
  return (
    <svg aria-hidden className="absolute size-0">
      <defs>
        {(Object.keys(MATRICES) as Exclude<CvdMode, "none">[]).map((mode) => (
          <filter
            key={mode}
            id={`cvd-${mode}`}
            colorInterpolationFilters="linearRGB"
          >
            <feColorMatrix type="matrix" values={toValues(MATRICES[mode])} />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
