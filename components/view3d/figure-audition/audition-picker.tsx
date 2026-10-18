"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CANDIDATES, findCandidate, loadLocalManifest } from "./candidates";
import { OUTFITS } from "./figure-outfits";
import AuditionLineup from "./audition-lineup";
import {
  AUDITION_READOUT_ID,
  NO_EYE_OFFSET,
  useAuditionStore,
  type FigureLook,
} from "./audition-store";

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
  const eye =
    useAuditionStore((s) => s.eyeOffsets[s.candidate]) ?? NO_EYE_OFFSET;
  const setEyeOffset = useAuditionStore((s) => s.setEyeOffset);
  const setLocal = useAuditionStore((s) => s.setLocal);
  const palettes = useAuditionStore((s) => s.palettes);
  const setPalettes = useAuditionStore((s) => s.setPalettes);
  const palette = useAuditionStore((s) => s.palette);
  const setPalette = useAuditionStore((s) => s.setPalette);
  const tPose = useAuditionStore((s) => s.tPose);
  const setTPose = useAuditionStore((s) => s.setTPose);
  const handsView = useAuditionStore((s) => s.handsView);
  const setHandsView = useAuditionStore((s) => s.setHandsView);
  const requestFocusWrist = useAuditionStore((s) => s.requestFocusWrist);
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
  // Two menus instead of one long list: a set (bundled groups, then the
  // local manifest's groups), and the models in it. Prev and next step
  // through every model in order, across sets.
  const sets = useMemo(() => {
    const map = new Map<string, { id: string; label: string }[]>();
    map.set("Capsule figure", [{ id: "current", label: "Current (capsules)" }]);
    for (const x of CANDIDATES) {
      const g = x.group ?? "Bundled";
      map.set(g, [...(map.get(g) ?? []), x]);
    }
    for (const x of local) {
      const g = `${x.group ?? "Local"} (local only)`;
      map.set(g, [...(map.get(g) ?? []), x]);
    }
    return [...map.entries()];
  }, [local]);
  const setIndex = Math.max(
    0,
    sets.findIndex(([, items]) => items.some((x) => x.id === candidate)),
  );
  const [setLabel, items] = sets[setIndex];
  const step = (d: number) => {
    const all = sets.flatMap(([, i]) => i);
    const i = all.findIndex((x) => x.id === candidate);
    const n = all[(i + d + all.length) % all.length];
    if (n) setCandidate(n.id);
  };
  const hasPalettes = Boolean(c?.texture && palettes.length);
  const cyclePalette = (d: number) => {
    if (!hasPalettes) return;
    const ids = ["", ...palettes.map((x) => x.id)];
    const i = Math.max(0, ids.indexOf(palette));
    setPalette(ids[(i + d + ids.length) % ids.length]);
  };
  // While auditioning, the arrow keys walk models (left, right) and
  // palette variants (up, down). Captured ahead of the app's own arrow
  // hotkeys (media and device cycling), which this dev panel displaces.
  const keys = useRef({ step, cyclePalette });
  useEffect(() => {
    keys.current = { step, cyclePalette };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "SELECT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      const v = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (!d && !v) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (d) keys.current.step(d);
      else keys.current.cyclePalette(v);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const selectClass =
    "rounded border border-border bg-background px-1 text-foreground";
  const [lineup, setLineup] = useState(false);

  return (
    <>
      {lineup ? <AuditionLineup onClose={() => setLineup(false)} /> : null}
      <div
        data-chrome
        className="panel-frame absolute bottom-28 left-3 z-10 flex w-fit max-w-[min(92vw,46rem)] flex-col gap-1.5 whitespace-nowrap rounded-md border border-border p-2 font-mono text-xs text-muted-foreground"
      >
        <div className="flex items-center gap-2">
          <span className="text-foreground">Figure audition</span>
          <select
            aria-label="Figure set"
            className={`min-w-0 flex-1 py-0.5 ${selectClass}`}
            value={setLabel}
            onChange={(e) => {
              const next = sets.find(([l]) => l === e.target.value);
              if (next?.[1][0]) setCandidate(next[1][0].id);
            }}
          >
            {sets.map(([l]) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`px-1.5 ${selectClass}`}
            disabled={!local.length}
            onClick={() => setLineup(true)}
            title="Every local figure at once"
          >
            Lineup
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous model"
            className={`px-1.5 ${selectClass}`}
            onClick={() => step(-1)}
          >
            &lsaquo;
          </button>
          <select
            aria-label="Figure candidate"
            className={`min-w-0 flex-1 py-0.5 ${selectClass}`}
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
          >
            {items.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Next model"
            className={`px-1.5 ${selectClass}`}
            onClick={() => step(1)}
          >
            &rsaquo;
          </button>
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
              {look === "outfit" ? (
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
              ) : null}
              {hasPalettes ? (
                <label className="flex items-center gap-1">
                  Palette
                  <select
                    className={selectClass}
                    value={palette}
                    onChange={(e) => setPalette(e.target.value)}
                  >
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
                <input
                  type="checkbox"
                  checked={showRig}
                  onChange={(e) => setShowRig(e.target.checked)}
                />
                Show rig
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={tPose}
                  onChange={(e) => setTPose(e.target.checked)}
                />
                T-pose
              </label>
              <label
                className="flex items-center gap-1"
                title="Arms forward, palms down: both hands up close"
              >
                <input
                  type="checkbox"
                  checked={handsView}
                  onChange={(e) => setHandsView(e.target.checked)}
                />
                Hands
              </label>
              <button
                type="button"
                className="underline"
                onClick={() => requestFocusWrist(0)}
              >
                focus hands
              </button>
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
                  onChange={(e) =>
                    setEyeOffset(c.id, { ...eye, up: Number(e.target.value) })
                  }
                  className="w-20"
                />
                <span className="w-8 text-right tabular-nums">
                  {eye.up.toFixed(1)}
                </span>
              </label>
              <label className="flex items-center gap-1">
                fwd
                <input
                  type="range"
                  min={-8}
                  max={8}
                  step={0.5}
                  value={eye.fwd}
                  onChange={(e) =>
                    setEyeOffset(c.id, { ...eye, fwd: Number(e.target.value) })
                  }
                  className="w-20"
                />
                <span className="w-8 text-right tabular-nums">
                  {eye.fwd.toFixed(1)}
                </span>
              </label>
              <button
                type="button"
                className="underline"
                onClick={() => setEyeOffset(c.id, NO_EYE_OFFSET)}
              >
                reset
              </button>
            </div>
            <span id={AUDITION_READOUT_ID} />
          </>
        ) : null}
      </div>
    </>
  );
}
