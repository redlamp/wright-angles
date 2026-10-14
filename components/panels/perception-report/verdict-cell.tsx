"use client";

import { strokesSubAcuity } from "@/lib/display-math";
import { fitLabel, fitModeOf } from "@/lib/fit";
import { legibilityVerdict, VERDICT_LABELS } from "@/lib/legibility";
import { CautionIcon, VerdictIcon } from "@/components/legibility-ui";
import type { EntryVerdict } from "./use-entry-verdicts";

/**
 * One (text line × device) cell of the verdict matrix: the verdict as
 * a shape (✓ readable / ! tight / ✕ too small) and the arc minutes in
 * body text — color lives in the icon only, so nothing hinges on hue
 * or fails contrast.
 */
export function VerdictCell({ row }: { row: EntryVerdict | undefined }) {
  if (!row) return <td className="px-2 py-1.5" />;
  const d = row.device;
  // Fit modes crop: a box the device's fit trims away isn't on that
  // screen at all — a muted dash instead of a verdict. Measuring
  // through the device's actual rendered crop also means a cropped-in
  // box reads its true, bigger size on that screen.
  if (row.kind === "cropped") {
    return (
      <td
        className="px-2 py-1.5 text-muted-foreground"
        title={`${d.label}: cropped out by "${fitLabel(fitModeOf(d))}" — not shown on this screen`}
      >
        <span aria-hidden>—</span>
        <span className="sr-only">not shown (cropped out)</span>
      </td>
    );
  }
  // A stretched panel distorts: the figure is the HEIGHT one.
  const { m, stretch } = row;
  const sub = strokesSubAcuity(m.arcmin);
  return (
    <td
      className="px-2 py-1.5 whitespace-nowrap"
      title={`${d.label}: ${VERDICT_LABELS[legibilityVerdict(m.arcmin)]} — ${m.arcmin.toFixed(1)}′ · ${m.mm.toFixed(1)} mm tall · ${Math.round(m.devicePx)} device px${sub ? " · strokes under 1′ vanish" : ""}${stretch ? ` — ${stretch}` : ""}`}
    >
      <span className="inline-flex items-center gap-1 font-mono">
        <VerdictIcon arcmin={m.arcmin} />
        {m.arcmin.toFixed(0)}′
        {sub ? (
          <>
            <CautionIcon />
            <span className="sr-only">strokes thinner than 1′</span>
          </>
        ) : null}
        {stretch ? (
          <span className="text-muted-foreground" aria-label="height only (stretched)">
            *
          </span>
        ) : null}
      </span>
    </td>
  );
}
