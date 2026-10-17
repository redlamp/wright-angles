"use client";

import { Fragment, useMemo } from "react";
import { useAuditionStore } from "./audition-store";
import { DEFAULT_HAND_FIT, mirrorFit, normalizeFits, type HandFit } from "./hand-graft";

/** One slider row per fit value, the same range for both hands. */
const ROWS: { key: keyof HandFit; label: string; min: number; max: number; step: number; digits: number }[] = [
  { key: "size", label: "size", min: 0.7, max: 1.3, step: 0.01, digits: 2 },
  { key: "flareX", label: "flare X", min: 0.5, max: 2, step: 0.01, digits: 2 },
  { key: "flareY", label: "flare Y", min: 0.5, max: 2, step: 0.01, digits: 2 },
  { key: "slideX", label: "slide X", min: -4, max: 4, step: 0.1, digits: 1 },
  { key: "slideY", label: "slide Y", min: -4, max: 4, step: 0.1, digits: 1 },
  { key: "slideZ", label: "slide Z", min: -4, max: 4, step: 0.1, digits: 1 },
  { key: "rotX", label: "rot X", min: -45, max: 45, step: 0.5, digits: 1 },
  { key: "rotY", label: "rot Y", min: -45, max: 45, step: 0.5, digits: 1 },
  { key: "rotZ", label: "rot Z", min: -45, max: 45, step: 0.5, digits: 1 },
];

const SIDES = [
  { side: 1, key: "left", other: "right", label: "Left" },
  { side: -1, key: "right", other: "left", label: "Right" },
] as const;

/**
 * The grafted hands' fit for one model as a grid: a row per value, a
 * column per hand (slider and number), so left and right line up and
 * are dialed in separately. Each column can reset or take the other
 * hand's fit mirrored; the gizmos in T-pose write the same values. The
 * header folds the dials away, leaving the focus links.
 */
export default function HandFitTable({ candidateId, dim }: { candidateId: string; dim: boolean }) {
  const raw = useAuditionStore((s) => s.handFits[candidateId]);
  const fits = useMemo(() => normalizeFits(raw), [raw]);
  const setHandFit = useAuditionStore((s) => s.setHandFit);
  const requestFocusWrist = useAuditionStore((s) => s.requestFocusWrist);
  const open = useAuditionStore((s) => s.handDials);
  const setOpen = useAuditionStore((s) => s.setHandDials);
  return (
    <div className={`grid grid-cols-[auto_auto_auto_auto_auto] items-center gap-x-2 gap-y-0.5 ${dim ? "pointer-events-none opacity-40" : ""}`}>
      <button type="button" className="text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} hands
      </button>
      {SIDES.map(({ side, label }) => (
        <div key={side} className="col-span-2 flex items-baseline gap-2">
          <span>{label}</span>
          <button type="button" className="underline" onClick={() => requestFocusWrist(side)}>
            focus
          </button>
        </div>
      ))}
      {open ? ROWS.map((r) => (
        <Fragment key={r.key}>
          <span>{r.label}</span>
          {SIDES.map(({ side, key }) => {
            const f = fits[key];
            return (
              <Fragment key={side}>
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={f[r.key]}
                  onChange={(e) => setHandFit(candidateId, side, { ...f, [r.key]: Number(e.target.value) })}
                  className="w-20"
                />
                <span className="w-9 text-right tabular-nums">{f[r.key].toFixed(r.digits)}</span>
              </Fragment>
            );
          })}
        </Fragment>
      )) : null}
      {open ? <span className="text-muted-foreground">T-pose: gizmos</span> : null}
      {open ? SIDES.map(({ side, other }) => (
        <div key={side} className="col-span-2 flex gap-2">
          <button type="button" className="underline" onClick={() => setHandFit(candidateId, side, DEFAULT_HAND_FIT)}>
            reset
          </button>
          <button type="button" className="underline" title={`Take the ${other} hand's fit, mirrored`} onClick={() => setHandFit(candidateId, side, mirrorFit(fits[other]))}>
            mirror {other}
          </button>
        </div>
      )) : null}
    </div>
  );
}
