"use client";

import { useRef } from "react";
import { undoStroke, useBrush, usePaintStore } from "./figure-paint";

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
    <span className="flex items-center gap-2">
      <label
        className="flex items-center gap-1 text-foreground"
        title="Click or drag over Harry or Kim to color facets"
      >
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setBrush({ on: e.target.checked })}
        />
        Paint
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
