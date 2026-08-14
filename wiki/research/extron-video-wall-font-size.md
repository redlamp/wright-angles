---
tags: [domain/legibility, origin/external-research, status/verified]
---

# Extron Video Wall Font Size

Source: [Font Size and Legibility for Videowall Content](https://www.extron.com/article/videowallfontsize)
(Extron, from their Videowall Systems Design Guide). This article is how
Taylor first met angular font sizing; read in full 2026-08-14.

## Method

Size text by the visual angle it subtends for the **farthest** viewer —
the worst case drives the design. Extron's formula (calculator in
degrees):

> Arc Minutes = 60 × arctan(Text Height / Viewing Distance)

Same subtense math as [[arc-minute-spreadsheet]], minus the factor-2
half-angle refinement (negligible at these angles).

## Concrete numbers

- **Minimum:** text should occupy **10 vertical arc minutes** to be
  legible at all — but "eyestrain is likely over long periods of time."
- **Safe rule of thumb:** **15–20 arc minutes** for the farthest viewer.
  (Attributed to Simpson, *Videowalls: The Book of the Big Electronic
  Image*, Focal Press, 1996.)
- **Worked example (their Figure 2-13):** nearest viewer 15 ft (4.5 m),
  farthest 30 ft (9 m). 1-inch (25 mm) text = **19 arcmin** at 15 ft but
  only **10 arcmin** at 30 ft — "not acceptable for extended viewing."
  Doubling to 2 in (50 mm) restores 19 arcmin for the far viewer.
- **Distance rule of thumb:** **1 inch (25 mm) of text height per
  15 feet (4.5 m)** of maximum viewing distance (≈19 arcmin).
- **Points vs pixels:** a font's pixel height runs **30–35% larger than
  its point size** (12 pt ≈ 16 px). Rough render-metrics heuristic, not
  a typographic law — varies by font.
- **Worked pixel example:** 42-inch 1366×768 panels (37 PPI), farthest
  viewer 30 ft → text ≥ 2 in = **74 px** → specify ≈ **58 pt** in the
  authoring app.
- Content magnified across an n-wide array can use proportionally
  smaller font (2×2 wall → half the single-screen size).

## What this implies for Wright Angles

- Extron independently lands on the same thresholds as the Disco
  Elysium sheet: ~10 arcmin = floor, 15–20 arcmin = comfortable. Good
  triangulation for the tool's red/amber/green bands — see
  [[decision-arcminute-rosetta-stone]].
- The "1 inch per 15 feet" rule is a human-friendly inversion the tool
  could surface: given a distance, report the physical text height that
  hits a target arcmin value, not just the angle of what's there.
- The pt→px 130–135% heuristic is worth exposing as an estimator when
  the user only knows a point size, with a caveat that measured pixel
  height (as in [[arc-minute-spreadsheet]]) beats the heuristic.

Related: [[avixa-discas]] (the AV industry's formalization of the same
idea), [[iso-hfes-character-height-standards]], [[visual-acuity-and-ppd]].
