"use client";

import { useEffect, useRef, useState } from "react";

export const packName = (g: string) => g.replace("Mega-Pack: ", "");

/** A dropdown of the packs with a checkbox each, plus All and None. */
export default function PacksMenu({
  groups,
  hidden,
  onChange,
  className,
}: {
  groups: [string, number][];
  hidden: Set<string>;
  onChange: (hidden: Set<string>) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [open]);
  const shownN = groups.filter(([g]) => !hidden.has(g)).length;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className={`px-2 ${className}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Packs: {shownN} of {groups.length} ▾
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-10 mt-1 flex min-w-56 flex-col gap-0.5 rounded border border-border bg-background p-2 shadow-lg">
          <div className="mb-1 flex gap-2">
            <button
              type="button"
              className="underline"
              onClick={() => onChange(new Set())}
            >
              All
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => onChange(new Set(groups.map(([g]) => g)))}
            >
              None
            </button>
          </div>
          {groups.map(([g, n]) => (
            <label
              key={g}
              className="flex items-center gap-1.5 text-foreground"
            >
              <input
                type="checkbox"
                checked={!hidden.has(g)}
                onChange={(e) => {
                  const next = new Set(hidden);
                  if (e.target.checked) next.delete(g);
                  else next.add(g);
                  onChange(next);
                }}
              />
              {packName(g)}
              <span className="ml-auto text-muted-foreground">{n}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
