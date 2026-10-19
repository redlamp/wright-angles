"use client";

import { useEffect, useId, useState } from "react";
import {
  fitRows,
  optotypeRows,
  textLadderRows,
  type OptotypeRow,
  type TextLadderRow,
} from "@/lib/acuity-ladder";
import { LADDER_BOX } from "@/lib/legibility-card";
import { legibilityColor, VERDICT_LABELS } from "@/lib/legibility";
import type { Device } from "@/lib/types";

/** Row pitch as a multiple of row height. */
const LINE_GAP = 1.6;
/** Fixed label line, so labels never shrink below readable. */
const LABEL_PX = 14;
const MIN_LABELED_COL = 150;
const LADDER_TEXT = "Hxn Il1 O0 rnm";
/** Landolt C orientations, cycled so no row reads as a pattern. */
const DIRS = [0, 90, 180, 270, 45, 225, 135, 315];

/**
 * Cap height / font-size for the UI font, measured once the webfont is
 * in. The ladder sizes CAP height in arc minutes (what every other
 * reading in the app means by text size), so font-size = cap / ratio.
 */
function useCapRatio(): number {
  const [ratio, setRatio] = useState(0.7);
  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => {
      const g = document.createElement("canvas").getContext("2d");
      if (!g || !live) return;
      g.font = `500 100px ${getComputedStyle(document.body).fontFamily}`;
      const cap = g.measureText("H").actualBoundingBoxAscent;
      if (cap > 0) setRatio(cap / 100);
    });
    return () => {
      live = false;
    };
  }, []);
  return ratio;
}

/** Landolt C: 5-unit ring, 1-unit stroke and gap, opening at `deg`. */
function LandoltC({ size, deg }: { size: number; deg: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" className="shrink-0">
      <mask id={id}>
        <rect width="5" height="5" fill="white" />
        <rect
          x="2.5"
          y="2"
          width="2.5"
          height="1"
          fill="black"
          transform={`rotate(${deg} 2.5 2.5)`}
        />
      </mask>
      <circle
        cx="2.5"
        cy="2.5"
        r="2"
        fill="none"
        stroke="white"
        strokeWidth="1"
        mask={`url(#${id})`}
      />
    </svg>
  );
}

function rowLabel(main: string, devicePx: number, flag?: string) {
  return `${main} · ${devicePx < 10 ? devicePx.toFixed(1) : Math.round(devicePx)}px${flag ? ` · ${flag}` : ""}`;
}

/**
 * The viewer-relative half of the legibility card (lib/legibility-card.ts
 * holds the screen-relative half): optotypes and text sized in arc
 * minutes for THIS device at its own distance, drawn inside the
 * device's rect. The rect already shows the panel at its true angular
 * size, so device px map to CSS px by one scale.
 */
export function AcuityLadder({
  device,
  w,
  h,
  large,
}: {
  device: Device;
  w: number;
  h: number;
  large: boolean;
}) {
  const capRatio = useCapRatio();
  const k = device.resolution.h > 0 ? h / device.resolution.h : 0;
  if (!(k > 0)) return null;
  const boxW = w * (1 - LADDER_BOX.left - LADDER_BOX.right);
  const boxH = h * (1 - LADDER_BOX.top - LADDER_BOX.bottom);
  const colW = boxW / 2 - 8;
  // Labels are fixed-size; below this column width they'd crowd the
  // rows they describe, so small rects show the rows alone.
  const labeled = large && colW >= MIN_LABELED_COL;
  const labelH = labeled ? LABEL_PX + 2 : 0;
  // Each column fits its own rows into the box height (minus padding
  // and the column heading).
  const budget = boxH - 8 - labelH;
  const rowH = (r: { devicePx: number }) =>
    r.devicePx * k * LINE_GAP + labelH;
  const text: TextLadderRow[] = fitRows(textLadderRows(device), rowH, budget);
  const opto: OptotypeRow[] = fitRows(optotypeRows(device), rowH, budget);

  return (
    <div
      className="pointer-events-none absolute flex gap-2 overflow-hidden rounded-sm bg-[#161616]/90 p-1 text-white"
      style={{
        left: `${LADDER_BOX.left * 100}%`,
        top: `${LADDER_BOX.top * 100}%`,
        right: `${LADDER_BOX.right * 100}%`,
        bottom: `${LADDER_BOX.bottom * 100}%`,
      }}
      aria-label={`Acuity ladder for ${device.label}`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {labeled ? (
          <span className="truncate font-mono text-[11px] leading-4 text-white/60">
            cap height (arcmin)
          </span>
        ) : null}
        {text.map((r) => {
          const cap = r.devicePx * k;
          const flag = r.subPixelStrokes
            ? "sub-px strokes"
            : r.subAcuityStrokes
              ? "strokes < 1′"
              : undefined;
          return (
            <div key={r.arcmin} style={{ height: rowH(r) }}>
              {labeled ? (
                <div
                  className="truncate font-mono text-[11px] leading-[14px]"
                  style={{ color: legibilityColor(r.arcmin) }}
                >
                  {rowLabel(`${r.arcmin}′ ${VERDICT_LABELS[r.verdict]}`, r.devicePx, flag)}
                </div>
              ) : null}
              <div
                className="font-sans font-medium whitespace-nowrap"
                style={{ fontSize: cap / capRatio, lineHeight: 1.25 }}
              >
                {LADDER_TEXT}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {labeled ? (
          <span className="truncate font-mono text-[11px] leading-4 text-white/60">
            Landolt C (Snellen)
          </span>
        ) : null}
        {opto.map((r, ri) => {
          const size = r.devicePx * k;
          const count = Math.max(1, Math.min(5, Math.floor(colW / (size * 1.6))));
          return (
            <div
              key={r.label}
              style={{ height: rowH(r), opacity: r.pixelLimited ? 0.35 : 1 }}
            >
              {labeled ? (
                <div className="truncate font-mono text-[11px] leading-[14px] text-white/80">
                  {rowLabel(
                    `${r.label} ${r.arcmin}′`,
                    r.devicePx,
                    r.pixelLimited ? "gap < 1px" : undefined,
                  )}
                </div>
              ) : null}
              <div className="flex" style={{ gap: size * 0.6 }}>
                {Array.from({ length: count }, (_, j) => (
                  <LandoltC
                    key={j}
                    size={size}
                    deg={DIRS[(ri * 3 + j * 5) % DIRS.length]}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
