"use client";

import { useEffect } from "react";
import { CANDIDATES, findCandidate, loadLocalCandidates } from "./candidates";
import { OUTFITS } from "./figure-outfits";
import { AUDITION_READOUT_ID, useAuditionStore, type FigureLook } from "./audition-store";

/**
 * Dev-only overlay for swapping the viewer figure (FEATURE_FIGURE_AUDITION).
 * The stance, input and height controls stay in the scene HUD; this only
 * picks the body, its look and how it lines up.
 */
export default function AuditionPicker() {
  const candidate = useAuditionStore((s) => s.candidate);
  const setCandidate = useAuditionStore((s) => s.setCandidate);
  const look = useAuditionStore((s) => s.look);
  const setLook = useAuditionStore((s) => s.setLook);
  const outfit = useAuditionStore((s) => s.outfit);
  const setOutfit = useAuditionStore((s) => s.setOutfit);
  const showRig = useAuditionStore((s) => s.showRig);
  const setShowRig = useAuditionStore((s) => s.setShowRig);
  const local = useAuditionStore((s) => s.local);
  const setLocal = useAuditionStore((s) => s.setLocal);
  useEffect(() => {
    let alive = true;
    loadLocalCandidates().then((list) => {
      if (alive) setLocal(list);
    });
    return () => {
      alive = false;
    };
  }, [setLocal]);
  const c = findCandidate(candidate, local);
  const selectClass = "rounded border border-border bg-background px-1 text-foreground";

  return (
    <div
      data-chrome
      className="panel-frame absolute bottom-14 left-3 z-10 flex max-w-96 flex-col gap-1.5 rounded-md border border-border p-2 font-mono text-xs text-muted-foreground"
    >
      <div className="flex items-center gap-2">
        <span className="text-foreground">Figure audition</span>
        <select
          aria-label="Figure candidate"
          className={`min-w-0 flex-1 py-0.5 ${selectClass}`}
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
        >
          <option value="current">Current (capsules)</option>
          <optgroup label="Bundled">
            {CANDIDATES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </optgroup>
          {local.length ? (
            <optgroup label="Local only (not redistributable)">
              {local.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      {c ? (
        <>
          <div className="break-all">
            {c.style} · {c.license} · {c.author}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1">
              Look
              <select
                className={selectClass}
                value={look}
                onChange={(e) => setLook(e.target.value as FigureLook)}
              >
                <option value="outfit">outfit</option>
                <option value="gray">gray</option>
                <option value="own">glTF material</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              Outfit
              <select
                className={selectClass}
                value={outfit}
                disabled={look !== "outfit"}
                onChange={(e) => setOutfit(e.target.value)}
              >
                {OUTFITS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showRig} onChange={(e) => setShowRig(e.target.checked)} />
              Show rig
            </label>
          </div>
          <span id={AUDITION_READOUT_ID} />
        </>
      ) : null}
    </div>
  );
}
