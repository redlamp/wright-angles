"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "./candidates";
import { useAuditionStore } from "./audition-store";
import {
  isPaintable,
  undoStroke,
  useBrush,
  usePaintStore,
} from "./figure-paint";

/** A few neutrals and primaries to start from, besides the figures' own swatches. */
const BASICS = [
  "#ffffff",
  "#d9d9d9",
  "#8c8c8c",
  "#3a3a3a",
  "#000000",
  "#e6c7b6",
  "#a3201c",
  "#c9541c",
  "#e0b030",
  "#3e6b48",
  "#2c5a8c",
  "#5a3a1e",
];

/**
 * The lineup's paint controls: Paint on or off, color, fill-part, undo,
 * clear, and export or import of every painted figure as JSON. Paints
 * live in this browser (local storage); export keeps a copy.
 */
export default function PaintBar({ className }: { className: string }) {
  const on = useBrush((s) => s.on);
  const color = useBrush((s) => s.color);
  const fill = useBrush((s) => s.fill);
  const setBrush = useBrush((s) => s.set);
  const undoCount = useBrush((s) => s.undo.length);
  const paints = usePaintStore((s) => s.paints);
  const replaceAll = usePaintStore((s) => s.replaceAll);
  // Swatches: each kit-bashed figure's own colors (its legend file), then recent paint colors.
  const local = useAuditionStore((s) => s.local);
  const legendUrls = useMemo(
    () =>
      local
        .filter(isPaintable)
        .map((c) => assetUrl(c.file.replace(/\.glb$/, "_legend.json"))),
    [local],
  );
  const [figureColors, setFigureColors] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all(
      legendUrls.map((u) =>
        fetch(u, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
      ),
    ).then((legends: Record<string, unknown>[]) => {
      if (alive)
        setFigureColors(
          [...new Set(legends.flatMap((l) => Object.keys(l)))].filter(
            (c) => c !== "#ffffff",
          ),
        );
    });
    return () => {
      alive = false;
    };
  }, [legendUrls]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    for (const fig of Object.values(paints))
      for (const m of Object.values(fig))
        for (const c of Object.values(m)) seen.add(c);
    return [...seen].slice(-12);
  }, [paints]);
  const chip = (c: string) => (
    <button
      key={c}
      type="button"
      title={c}
      onClick={() => setBrush({ color: c })}
      className={`h-4 w-4 rounded-sm border ${c === color ? "border-white" : "border-black/40"}`}
      style={{ background: c }}
    />
  );
  const file = useRef<HTMLInputElement>(null);
  const faces = Object.values(paints).reduce(
    (n, fig) =>
      n + Object.values(fig).reduce((m, f) => m + Object.keys(f).length, 0),
    0,
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(paints, null, 1)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "figure-paint.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try {
      replaceAll(JSON.parse(await f.text()));
    } catch (e) {
      console.warn("[figure-audition] paint import failed:", e);
    }
  };
  const clearAll = () => {
    if (window.confirm(`Clear all ${faces} painted facets?`)) replaceAll({});
  };

  return (
    // contents: the controls join the header row; the swatches wrap to a row of their own (order-last, full width).
    <span className="contents">
      <label
        className="flex items-center gap-1 text-foreground"
        title="Click or drag over Harry or Kim to color facets (P toggles)"
      >
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setBrush({ on: e.target.checked })}
        />
        Paint (P)
      </label>
      <input
        type="color"
        value={color}
        onChange={(e) => setBrush({ color: e.target.value })}
        className="h-5 w-8 cursor-pointer bg-transparent"
        aria-label="Paint color"
      />
      <label
        className="flex items-center gap-1"
        title="Color every facet that wears the same swatch"
      >
        <input
          type="checkbox"
          checked={fill}
          onChange={(e) => setBrush({ fill: e.target.checked })}
        />
        Fill part
      </label>
      <span
        className="order-last flex basis-full flex-wrap items-center gap-0.5"
        title="Swatches: basics, Harry and Kim's own colors, recent"
      >
        {BASICS.map(chip)}
        <span className="mx-1 h-4 w-px bg-border" />
        {figureColors.map(chip)}
        {recent.length ? <span className="mx-1 h-4 w-px bg-border" /> : null}
        {recent
          .filter((c) => !BASICS.includes(c) && !figureColors.includes(c))
          .map(chip)}
      </span>
      <button
        type="button"
        className={`px-1.5 ${className}`}
        disabled={!undoCount}
        onClick={undoStroke}
      >
        Undo
      </button>
      <button
        type="button"
        className={`px-1.5 ${className}`}
        disabled={!faces}
        onClick={clearAll}
      >
        Clear
      </button>
      <button
        type="button"
        className={`px-1.5 ${className}`}
        disabled={!faces}
        onClick={exportJson}
      >
        Export
      </button>
      <button
        type="button"
        className={`px-1.5 ${className}`}
        onClick={() => file.current?.click()}
      >
        Import
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importJson(f);
          e.target.value = "";
        }}
      />
    </span>
  );
}
