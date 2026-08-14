---
tags: [domain/product, status/adopted]
---

# Plan 2026-08-15 — Pro Polish Sprint

Taylor's overnight list (2026-08-14 23:27) plus my additions, prioritized.
Goal: professional app feel — shadcn-forward visuals on the color-taylor
("Anodised") tokens, coherent density, no hand-rolled-looking controls.

## P0 — feel + core insight (build tonight)

1. **Device Manager rebuild** — fixed column grid so every distance
   slider is the same width; ± steppers (1 unit, Shift=10) on distance
   and size; shadcn Button/Input/Tooltip everywhere; tighter rows.
2. **Onboarding wizard** — first-run dialog calibrating This Device
   (preset picker or custom size/res/distance), short "why arc minutes"
   step, re-launchable from Settings. The tool is meaningless until This
   Device is right, so it can't stay buried in a panel.
3. **Perception report** — per device: "on your screen this rect is X cm
   wide; in real life a [device] at [dist] subtends Y% more/less of your
   view." The product's thesis (what you see ≠ how it ships) stated in
   words, with arcmin legibility bands from [[iso-hfes-character-height-standards]].
4. **Save / import / export** — devices+settings to a versioned JSON
   file; import with validation. Studio users will want shareable rigs.
5. **Settings expansion** — theme, units, storage usage, thresholds
   toggle, re-run onboarding, wipe. (Was: three controls.)

## P1 — media + 3D depth (tonight if the night allows)

6. **Media Library overhaul** — rename, sort (added/name), list/grid
   toggle, selected-image detail card, delete confirmation; **generated
   images** (SMPTE-ish bars, alignment grid, gradient, solid fill) so the
   tool is useful with zero imports; **device-color fill option** for
   empty rects ("fill = key color" mode).
7. **3D figures** — real standing + sitting person models (CC0) with
   height control (drives eye height: standing ≈ 0.936·H, sitting ≈
   0.45·H + 45cm chair) and posture toggle; distance still per-device.
8. **2D↔3D camera transition** — animate from head-on (2D-like) framing
   to the 3/4 view on mode switch so the distance relationship reads.
9. **Reference game images** — recent-game press shots fetched to
   `public/reference/` (gitignored) + manifest; "Load samples" in the
   Media Library imports them locally.

## P2 — proposed by me, for Taylor to rank (not built yet)

- **Browser-zoom / DPR sanity warning** — non-100% zoom silently breaks
  1:1 scale; detect and badge it.
- **Credit-card calibration** — drag a rect to match a physical card to
  verify This Device's true PPI (catches OS scaling lies).
- **Font probe** — type a string, set px, see it rendered on each device
  at true scale with its arcmin value and pass/fail bands.
- **Highlight rectangles** (PRD) — draw rects on the image, get arcmin
  readouts per device. The legibility-measuring core, needs a design pass.
- **Per-device image assignment** — different capture per device.
- **Shareable setup links** — encode device rig in URL hash (no server).
- **Comparison table view** — all devices × (size, distance, H°, V°,
  PPD, ′/px) as a sortable table; the spreadsheet, live.
- **Distance scrub in 3D** — drag a device rect along the sight line.
- **EXIF strip on import** — privacy hygiene for studio captures.
- **Non-linear distance slider** (PRD open question) — log scale above
  ~150cm.

## Build order note

Store changes land first (viewer store; media store generators +
display-fill mode; export schema), then panels, then 3D, so agents can
work files in parallel without collisions.
