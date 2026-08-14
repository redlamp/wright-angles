---
tags: [domain/product, status/open]
---

# Test Plan 2026-08-15 — First Build

Run `bun run dev` → http://localhost:7841. Everything below was built
overnight 08-14→15; items marked ⚠ could not be fully verified by
automation (the Chrome window was hidden, which suspends WebGL frames).

## Setup / calibration

- [ ] App loads dark, Anodised-style; Device Manager and sidebar present.
- [ ] Set This Device to your actual panel (49″ 5120×1440 G9 preset is in
      Add device → Monitors) and your real distance (~70cm).
- [ ] Unit toggle (Settings) flips size/distance readouts cm ⇄ in.

## Device Manager

- [ ] Collapsed rows still adjust distance via slider (Miro requirement).
- [ ] Expand a device: size slider + field, aspect dropdown, resolution
      chips, key color, delete all work.
- [ ] Arcmin readout updates live as you drag distance (the rosetta
      stone line: H′ × V′, px/°, ′/px, ppi).
- [ ] Add device menu groups presets (handhelds/phones/monitors/TVs);
      added devices get distinct auto colors.
- [ ] Eye toggles hide/show rects in both views.
- [ ] Reload: devices, positions, and settings persist (localStorage).

## Media Library

- [ ] Drag an image anywhere on the window → drop scrim → appears in
      library (also: click-to-browse in the panel).
- [ ] Reference size defaults to native height; changing it rescales the
      overlay content (1080p capture on 1440p device scales up).
- [ ] Reload: images persist (IndexedDB). Remove works.

## 2D overlay — the core

- [ ] With your G9 calibrated: add Switch 2 @ 40cm. Hold a real Switch
      (or ruler) at 40cm — the on-screen rect should feel the same size
      when the scale chip (bottom-right) reads **1:1** (fullscreen at
      native res, browser zoom 100%).
- [ ] Sanity vs the sheet: 27″ 1440p @ 70cm This Device shows 46.2° ×
      27.8° in the readout; Switch @ 36cm rect ≈ 45% of its width.
- [ ] Labels sit on alternating corners and stay legible when rects nest.

## 3D view ⚠

- [ ] Geometry verified: figure, dashed sight line, true-scale rects at
      distance, drop lines. **Check: device name + distance labels** —
      drei/troika text didn't paint under automation; likely fine when
      the tab is actually visible. If labels are missing, tell Claude.
- [ ] Orbit/zoom feel OK; initial framing sensible for your device set.

## Deploy (needs your go-ahead)

- [ ] Workflow + Pages config are ready; first deploy happens when you
      say to merge dev → main. Then check
      https://redlamp.github.io/wright-angles/ (and /dev slot).

## Decisions Taylor owes (from [[review-2026-08-15-open-questions]])

- [ ] License choice
- [ ] Arcmin threshold presentation (which numbers to surface)
