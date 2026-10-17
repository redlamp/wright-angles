"use client";

import { useEffect, useMemo } from "react";
import { CANDIDATES, findCandidate, loadLocalManifest } from "./candidates";
import { OUTFITS } from "./figure-outfits";
import { AUDITION_READOUT_ID, NO_EYE_OFFSET, useAuditionStore, type FigureLook } from "./audition-store";

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
  const eye = useAuditionStore((s) => s.eyeOffsets[s.candidate]) ?? NO_EYE_OFFSET;
  const setEyeOffset = useAuditionStore((s) => s.setEyeOffset);
  const setLocal = useAuditionStore((s) => s.setLocal);
  const palettes = useAuditionStore((s) => s.palettes);
  const setPalettes = useAuditionStore((s) => s.setPalettes);
  const palette = useAuditionStore((s) => s.palette);
  const setPalette = useAuditionStore((s) => s.setPalette);
  useEffect(() => {
    let alive = true;
    loadLocalManifest().then(({ candidates, palettes: pals }) => {
      if (!alive) return;
      setLocal(candidates);
      setPalettes(pals);
    });
    return () => {
      alive = false;
    };
  }, [setLocal, setPalettes]);
  const c = findCandidate(candidate, local);
  // Local manifests can list a whole pack; group them as the manifest says.
  const localGroups = useMemo(() => {
    const map = new Map<string, typeof local>();
    for (const x of local) {
      const g = x.group ?? "Local";
      map.set(g, [...(map.get(g) ?? []), x]);
    }
    return [...map.entries()];
  }, [local]);
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
          {localGroups.map(([group, items]) => (
            <optgroup key={group} label={`${group} (local only)`}>
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </optgroup>
          ))}
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
            {c.texture && palettes.length ? (
              <label className="flex items-center gap-1">
                Palette
                <select className={selectClass} value={palette} onChange={(e) => setPalette(e.target.value)}>
                  <option value="">model default</option>
                  {palettes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showRig} onChange={(e) => setShowRig(e.target.checked)} />
              Show rig
            </label>
          </div>
          {/* Nudge where this model's eyes are taken to be; the cyan dot in
              the rig overlay shows the eye point, so dial until it sits in
              the eye sockets. Values are world cm. */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              Eyes up
              <input
                type="range"
                min={-8}
                max={8}
                step={0.5}
                value={eye.up}
                onChange={(e) => setEyeOffset(c.id, { ...eye, up: Number(e.target.value) })}
                className="w-20"
              />
              <span className="w-8 text-right tabular-nums">{eye.up.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1">
              fwd
              <input
                type="range"
                min={-8}
                max={8}
                step={0.5}
                value={eye.fwd}
                onChange={(e) => setEyeOffset(c.id, { ...eye, fwd: Number(e.target.value) })}
                className="w-20"
              />
              <span className="w-8 text-right tabular-nums">{eye.fwd.toFixed(1)}</span>
            </label>
            <button type="button" className="underline" onClick={() => setEyeOffset(c.id, NO_EYE_OFFSET)}>
              reset
            </button>
          </div>
          <span id={AUDITION_READOUT_ID} />
        </>
      ) : null}
    </div>
  );
}
