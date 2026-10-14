"use client";

import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  CircleXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";
import {
  legibilityVerdict,
  VERDICT_LABELS,
  type LegibilityVerdict,
} from "@/lib/legibility";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Small shared pieces for showing legibility without leaning on color
 * alone: verdicts carry a shape AND words (screen-reader text), device
 * identity is a swatch beside a foreground-colored name, and jargon
 * gets a "?" definition. Verdict hues are tuned per theme so the icons
 * hold 3:1 against both the light and dark panels (WCAG 1.4.11).
 */

/** Verdict icon color, per theme (light first, dark override). */
export const VERDICT_ICON_CLASS: Record<LegibilityVerdict, string> = {
  pass: "text-[#218358] dark:text-[#3dd68c]",
  tight: "text-[#ab6400] dark:text-[#ffca16]",
  fail: "text-[#ce2c31] dark:text-[#ff9592]",
};

const VERDICT_ICON = {
  pass: CircleCheckIcon,
  tight: CircleAlertIcon,
  fail: CircleXIcon,
} as const;

/** ✓ / ! / ✕ for an arc-minute reading, with its verdict as hidden text. */
export function VerdictIcon({
  arcmin,
  className,
}: {
  arcmin: number;
  className?: string;
}) {
  const v = legibilityVerdict(arcmin);
  const Icon = VERDICT_ICON[v];
  return (
    <>
      <Icon
        aria-hidden
        className={cn("size-3.5 shrink-0", VERDICT_ICON_CLASS[v], className)}
      />
      <span className="sr-only">{VERDICT_LABELS[v]}</span>
    </>
  );
}

/** Amber caution triangle for non-verdict warnings (sub-retina, stretch). */
export function CautionIcon({ className }: { className?: string }) {
  return (
    <TriangleAlertIcon
      aria-hidden
      className={cn("size-3 shrink-0", VERDICT_ICON_CLASS.tight, className)}
    />
  );
}

/** The device's key color as an identity swatch (never text color). */
export function DeviceSwatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: color }}
    />
  );
}

/** "?" after a term; hover or focus shows its one-line definition. */
export function HelpTip({
  term,
  className,
}: {
  term: GlossaryTerm;
  className?: string;
}) {
  const text = GLOSSARY[term];
  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          aria-label={text}
          className={cn(
            "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <CircleHelpIcon aria-hidden className="size-3" />
        </TooltipTrigger>
        <TooltipContent className="font-sans">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
