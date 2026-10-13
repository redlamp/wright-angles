import { cn } from "@/lib/utils";
import { GUIDE_COLOR } from "./constants";

/**
 * Small explanatory drawings for the two measuring methods. Decorative
 * (aria-hidden): the step's text carries the instruction. Strokes use
 * currentColor so both themes work; the guide uses the stage's hue.
 */

export function CardIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      aria-hidden
      className={cn("text-muted-foreground", className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The screen. */}
      <rect x="2" y="2" width="116" height="64" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M52 66 L49 76 H71 L68 66" stroke="currentColor" strokeWidth="2" />
      {/* The corner guide on screen. */}
      <path d="M14 34 V14 H34" className={GUIDE_COLOR} stroke="currentColor" strokeWidth="3" />
      {/* The shape being sized, peeking past the card's right edge. */}
      <rect x="16" y="16" width="62" height="39" rx="3" className="fill-foreground/25" />
      {/* The real card, held flat, top-left corner in the guide. */}
      <rect x="16" y="16" width="56" height="35" rx="3" className="fill-background" stroke="currentColor" strokeWidth="2" />
      <rect x="22" y="24" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 42 H52" stroke="currentColor" strokeWidth="1.5" />
      {/* Drag the right edge in. */}
      <path d="M96 36 H84 M88 32 L84 36 L88 40" className="text-foreground" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function RulerIllustration({ className }: { className?: string }) {
  const ticks = Array.from({ length: 11 }, (_, i) => 14 + i * 8);
  return (
    <svg
      viewBox="0 0 120 80"
      aria-hidden
      className={cn("text-muted-foreground", className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="116" height="64" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M52 66 L49 76 H71 L68 66" stroke="currentColor" strokeWidth="2" />
      {/* The on-screen bar with its 0 anchor. */}
      <path d="M14 18 V30" className={GUIDE_COLOR} stroke="currentColor" strokeWidth="3" />
      <rect x="14" y="22" width="80" height="4" rx="2" className="fill-foreground/60" />
      <circle cx="94" cy="24" r="4" className="fill-background" stroke="currentColor" strokeWidth="2" />
      {/* The real ruler laid along it. */}
      <rect x="8" y="32" width="100" height="20" rx="2" className="fill-background" stroke="currentColor" strokeWidth="2" />
      {ticks.map((x, i) => (
        <path key={x} d={`M${x} 32 V${i % 5 === 0 ? 42 : 38}`} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
