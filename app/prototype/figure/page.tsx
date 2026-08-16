"use client";

import dynamic from "next/dynamic";

// Prototype route (not linked from the app): side-by-side evaluation of
// the CC0 Quaternius Universal Base Character against the current
// procedural mannequin, before committing to a rig retarget. Assets live
// gitignored under public/prototype/ — see wiki/notes/prototype-figure-rig.md
// for how to restore them. Delete this route once the decision is made.
const FigureCompare = dynamic(
  () => import("@/components/prototype/figure-compare"),
  { ssr: false },
);

export default function FigurePrototypePage() {
  return <FigureCompare />;
}
