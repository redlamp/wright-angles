---
tags: [domain/product, status/open]
---

# Test Plan 2026-08-15 — V2 Sprint

`bun run dev` → http://localhost:7841. Local state was reset so you get
the true first-run. Items marked ⚠ need your eyes (hidden-window
automation can't verify WebGL or feel).

## Onboarding

- [x] First load: welcome dialog → Calibrate my screen → presets/steppers
      with live degree readout → scenario step → Done. Skip works too.
- [x] Settings → "Run setup assistant again" re-opens it.

## Device Manager (rebuilt)

- [x] Every distance slider is the same width, regardless of name length.
- [x] Steppers: −/+ nudge by 1 (Shift = 10); value field editable;
      arrow keys work in the field. Same on display size.
- [x] Units toggle switches all steppers/readouts cm ⇄ in.
- [x] Curve select on your G9 preset (1000R): horizontal degrees in the
      readout jump ~6° vs Flat — the wrap effect.
- [x] Screen height: Eye level toggle ⇄ manual slider (3D only).
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
- [x] Theme: System follows OS; Dark/Light force. 3D scene: Match UI /
      Dark / Light. ⚠ check scene light palette legibility.
- [x] Storage usage bar shows; wipe still two-step.

## 3D scene ⚠

- [x] Scenario toggle Standing / At a desk / On a couch: figure pose,
      desk/couch props, eye height all change; height slider scales.
- [x] 2D→3D: camera starts head-on and flies to the 3/4 view; 3D→2D
      flies back before switching. Interrupt mid-flight — no snapping.
- [x] Screen height override on a device moves its rect vertically.
- [x] Content textures on device screens (image + video), handheld
      chassis around Switch/Deck screens, curved G9 screen, pose tween
      with hands, FPS readout — landed this morning, verify all.

## 2D export

- [x] "export view" downloads a PNG of the composition at native res
      with labels + footer stamp.

## Open decisions (carried + new)

- [x] License (from yesterday) — MIT adopted.
- [x] Dev → main promotion for first Pages deploy.
- [ ] Whether measured-box verdicts should use cap-height convention
      (ISO) vs body-height (Xbox px minimums) — see research notes.

## Round 3 — review-fix verification (2026-08-15 morning)

- [ ] Device Manager: normal type sizes; distance slider in editor,
      4-char steppers in rows; Device name mirrors into Label until
      customized; in/cm flips on both size AND distance; curve shows
      "1000R" in the closed select; per-stance screen height; color
      swatch in row; rows open collapsed; drag-reorder shows an insert
      marker line where the device will land.
- [ ] Popups (reference size, curve, add-device) always above panels.
- [ ] 2D toolbar: scale line above fixed-width buttons in order
      measure · center · viewport · export; center toggle screen/window
      resets pan; hold-Space pan + double-click recenter.
- [ ] Letterbox bars take the key-color fill when enabled.
- [ ] 3D: rect heights tween on stance change; furniture animates
      in/out; natural handheld hold angle; PNG export from the HUD.

## Round 4 — figure + distance-handle affordances (2026-08-15 night)

- [ ] Figure reads as an Asaro-style planar mannequin: faceted cranium,
      jaw wedge, nose plane; flat-shaded masses visible from every
      orbit angle (the figure is the only lit thing in the scene).
- [ ] Eyes/sight line still land on the eye-height contract in all
      three stances — head rebuild must not shift the sight line.
- [ ] Hovering a floor distance node OR its distance text shows the
      open-hand (grab) cursor; while dragging it turns into the fist
      (grabbing); leaving either restores the default arrow.
- [ ] The distance text itself drags the viewing distance, same as the
      node (a grab cursor is a promise — the text keeps it).
- [ ] Cursor never sticks: releasing a drag off-target, or the pointer
      exiting the canvas mid-hover, returns the normal cursor.
- [ ] Mannequin is shaded (smooth forms, not flat fills) in both scene
      themes; silhouette unchanged from before.
- [ ] Input types row (Handheld / Gamepad / Mouse & KB) under the
      stance row: all 9 stance × input combos pose sensibly. Standing +
      Mouse & KB raises a standing desk; other standing inputs have no
      furniture; couch + Mouse & KB types on the lap.
- [ ] Height slider tracks the thumb instantly (figure, sight line,
      rects, labels); stance/input changes still tween at 0.5s.
- [ ] Device name + distance labels carry a subtle 1px-style black drop
      shadow; distance labels still render on top of ground, figure,
      and furniture (regression: the shadow's troika re-sync dropped
      the depthTest override until it moved into onSync).

## Suggested next (not yet built — rank these)

- [ ] Browser-zoom ≠ 100% detection + warning badge (1:1 silently wrong).
- [ ] Measure boxes mirrored into the 3D content texture.
- [ ] Credit-card calibration to verify true PPI against OS scaling.
- [ ] Comparison table view (all devices × H°/V°/PPD/′-per-px, CSV out).
- [ ] Per-device image assignment + hot-zone multi-image switching (PRD).
- [ ] Shareable setup links (URL hash) alongside export/import.
- [ ] Sub-retina (<60 PPD) indicator per device — research shows Switch
      OLED and Deck LCD sit just under it at hold distance.
- [ ] EXIF strip on image import (studio privacy hygiene).
- [ ] Non-linear distance slider above ~150cm.
- [ ] Keyboard shortcuts (panel toggles, view switch, measure mode).
- [ ] Crop tool for active media — e.g. a 1920×1112 capture with browser
      chrome cropped to the bottom 1920×1080 so only the content shows
      (Taylor 2026-08-15, future task).
- [ ] Label declutter, attempt 2: Phase-1 greedy screen-space version was
      reverted (bad layout + a recompute loop that stalled the app —
      its effect keyed on an array rebuilt every render). Taylor's
      direction for next attempt: place distance labels at a fixed
      30° south-east offset from the drop-line node's screen
      projection — deterministic, no per-rest solving. Build it on a
      memoized `visible` list and verify against the stall first.
