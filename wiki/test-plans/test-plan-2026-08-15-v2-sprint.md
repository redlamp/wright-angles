---
tags: [domain/product, status/open]
---

# Test Plan 2026-08-15 — V2 Sprint

`bun run dev` → http://localhost:7841. Local state was reset so you get
the true first-run. Items marked ⚠ need your eyes (hidden-window
automation can't verify WebGL or feel).

## Onboarding

- [ ] First load: welcome dialog → Calibrate my screen → presets/steppers
      with live degree readout → scenario step → Done. Skip works too.
- [ ] Settings → "Run setup assistant again" re-opens it.

## Device Manager (rebuilt)

- [ ] Every distance slider is the same width, regardless of name length.
- [ ] Steppers: −/+ nudge by 1 (Shift = 10); value field editable;
      arrow keys work in the field. Same on display size.
- [ ] Units toggle switches all steppers/readouts cm ⇄ in.
- [ ] Curve select on your G9 preset (1000R): horizontal degrees in the
      readout jump ~6° vs Flat — the wrap effect.
- [ ] Screen height: Eye level toggle ⇄ manual slider (3D only).
- [ ] Readout bottom line: px needed for 16′/20′ on that device.

## Measure mode (new core feature)

- [ ] With an image active: bottom-right "measure" → drag a box around
      a text line. Box color = worst-device verdict (green/amber/red).
- [ ] The same box appears at true scale on every nested device rect.
- [ ] Perception Report → Measured boxes: source px + per-device arcmin
      dots. Click row ⇄ selects box; Delete key or trash removes it.
- [ ] Esc exits measure mode. Boxes persist across reloads (IndexedDB).

## Perception Report

- [ ] Per device: "appears N% of the size on your screen / N× larger"
      sentences + 24px probe verdicts. Probe steppers change px/ref.

## Media Library (overhauled)

- [ ] Grid/list toggle, sort, inline rename, two-step remove.
- [ ] "New test image" menu: bars / grid / gradient / solid.
- [ ] "Load samples" imports the local game screenshots (gitignored;
      button hidden if the folder is missing).
- [ ] Drop a short gameplay VIDEO: imports with poster thumbnail, plays
      muted+looped in every rect at correct scale. ⚠ perf with 4+ rects.
- [ ] "Empty device fill": Black ⇄ Key color changes imageless rects.

## Settings / setup

- [ ] Export downloads a JSON; Import restores it (try round-trip).
- [ ] Theme: System follows OS; Dark/Light force. 3D scene: Match UI /
      Dark / Light. ⚠ check scene light palette legibility.
- [ ] Storage usage bar shows; wipe still two-step.

## 3D scene ⚠

- [ ] Scenario toggle Standing / At a desk / On a couch: figure pose,
      desk/couch props, eye height all change; height slider scales.
- [ ] 2D→3D: camera starts head-on and flies to the 3/4 view; 3D→2D
      flies back before switching. Interrupt mid-flight — no snapping.
- [ ] Screen height override on a device moves its rect vertically.
- [ ] Content textures on device screens (image + video), handheld
      chassis around Switch/Deck screens, curved G9 screen, pose tween
      with hands, FPS readout — landed this morning, verify all.

## 2D export

- [ ] "export view" downloads a PNG of the composition at native res
      with labels + footer stamp.

## Open decisions (carried + new)

- [ ] License (from yesterday).
- [ ] Dev → main promotion for first Pages deploy.
- [ ] Whether measured-box verdicts should use cap-height convention
      (ISO) vs body-height (Xbox px minimums) — see research notes.
