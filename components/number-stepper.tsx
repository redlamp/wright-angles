"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Compact − [value] + control. Click steps by `step`; Shift-click by
 * `bigStep`. The field itself is editable and commits on blur/Enter.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  bigStep = 10,
  min = -Infinity,
  max = Infinity,
  decimals = 0,
  suffix,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  bigStep?: number;
  min?: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  ariaLabel: string;
}) {
  const shown = value.toFixed(decimals);
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);
  // Derived-state reconciliation during render (not an effect): keep the
  // field following external changes unless the user is mid-edit.
  const [prevShown, setPrevShown] = useState(shown);
  if (shown !== prevShown) {
    setPrevShown(shown);
    if (!editing) setDraft(shown);
  }

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const nudge = (dir: 1 | -1, shift: boolean) =>
    onChange(clamp(value + dir * (shift ? bigStep : step)));
  const commit = () => {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(clamp(n));
    else setDraft(shown);
  };

  return (
    <div
      className={cn(
        "flex h-6 items-center overflow-hidden rounded-md border border-input",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        tabIndex={-1}
        className="flex h-full w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={(e) => nudge(-1, e.shiftKey)}
      >
        <MinusIcon className="size-3" />
      </button>
      <Input
        aria-label={ariaLabel}
        className="h-full w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-center font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        value={editing ? draft : suffix ? `${shown}` : shown}
        onFocus={(e) => {
          setEditing(true);
          e.target.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp") { e.preventDefault(); nudge(1, e.shiftKey); }
          if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1, e.shiftKey); }
        }}
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        tabIndex={-1}
        className="flex h-full w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={(e) => nudge(1, e.shiftKey)}
      >
        <PlusIcon className="size-3" />
      </button>
    </div>
  );
}
