---
tags:
  - domain/legibility
  - domain/product
  - status/adopted
  - origin/taylor
---

# Q&A Decisions — Media Debug Track (2026-08-17)

Decisions and clarifications from Taylor's morning review of
[[test-plan-2026-08-17-v3-media-debug]]. Item numbers refer to that plan.

## What "ISO minimum at couch distance" means (plan 6.x)

The summary verdict ("12 of 40 lines under ISO minimum at couch
distance") unpacks as:

- **ISO minimum** = ISO 9241-303's 16-arcmin character-height floor
  (capital/cap height), with 20–22′ as the comfort band — full
  citations in [[iso-hfes-character-height-standards]]. The app also
  carries 1′ (detail acuity) and 20′ (comfortable) as the other
  ACUITY constants in `lib/display-math.ts`.
- **At couch distance** = evaluated per device at THAT stance's
  viewing distance. The pipeline per OCR line: measured px height →
  physical mm on the device panel (via its PPI) → arc minutes
  subtended at the device's `distanceCm` for the active stance.
- The matrix (plan 6.x/Stage 2) shows the actual numbers per line ×
  device against both thresholds, so the summary count is clickable
  down to each failing line. Wording uses "(cap height)" per Taylor's
  earlier ISO-wording decision.

## Other decisions from the Q&A

- **Exports are local downloads** (audit CSV/markdown, like the PNG
  export). Nothing leaves the machine — consistent with
  [[decision-local-only-media]].
- **This Device is "blessed"**: it is the foundation of the vision
  model, not just another row. In the perception report, a selected
  device's details render NEXT TO This Device's (plan 6.5). Verdict
  coloring defaults accordingly.
- **Video OCR is user-driven, not auto-cadence** (plan 9): the user
  sets keyframes on the timeline, scans run per keyframe (batch or
  piecemeal), markers are navigable with `<`/`>` (jump + pause),
  Space toggles play/pause, and a scan persists until the next marker.
- **OCR feeds the perception report** (plan 8): approved; depends on
  text grouping (plan 7) so descender-less lines aren't undersized.
- **OCR descender problem** (plan 7): a line without descenders
  measures only visible ink and under-reports font size. Fix via
  grouping nearby lines (inferring wrap + line spacing), assuming one
  font size per group, with a visible group indicator.
- **Type scale lives inside the design system** (plan 2): Taylor
  wants demonstrable design-system craft — sizes come from Tailwind's
  type tokens and shadcn conventions, no arbitrary pixel values.
  REVISED 18:01: the whole scale shifted up one rung — `text-base`
  (16px) is the working default for content and controls, `text-sm`
  (14px) is the captions/microlabels/mono floor, `text-xs` is banned.
  The shadcn ui components themselves were re-based accordingly
  (Button base/sm/xs, Input, Select, Dropdown, Tooltip).
- **Hotkey map confirmed** (plan 4): m/d/p/c/s panels · Tab 2D↔3D ·
  o OCR overlay · x crop · 1/2/3 stances · q/w/e input types ·
  ? cheat-sheet overlay (to be built — does not exist yet).
  2D interaction change: DROP Space-to-pan; left mouse selects on
  click and pans on drag.
- **Per-device media assignment** (plan 11.4): spec sketched (each
  device holds its own image; hot zones switch the foregrounded
  content) — awaiting Taylor's go/no-go.
- **Shareable links deferred** (plan 11.6): implies shared data,
  which the local-only promise avoids for now.
