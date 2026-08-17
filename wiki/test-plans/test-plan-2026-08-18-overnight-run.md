# Test Plan v4 — Overnight Run Review (2026-08-18)

Numbered for call-outs, same as [[test-plan-2026-08-17-v3-media-debug]]
(old numbers in parens). Everything Taylor didn't respond to today
carries over; the overnight build queue lands under topics 5–6.
Taylor reviews in the morning.

## 1. Carry-over: built earlier today, needs Taylor's eyes

- [ ] 1.1 (3.1–3.3) Device inspector: click a device in 2D/3D/table →
      floating card (details, hide/show eye, Edit in Device Manager
      link); header-draggable; idles at 40% alpha, wakes on hover;
      Esc closes.
- [ ] 1.2 (10.5) Color-vision simulation: chip in the 2D bottom-right
      toolbar and next to Export view in the 3D HUD (moved out of the
      inspector per Taylor 22:47; select popups now fit their items).
      Protan/deutan/tritan + achromatopsia; views only, panels stay
      unfiltered; persisted.
- [ ] 1.3 (11.1) Amber "browser zoom ≈ N%" chip over the 2D scale
      caption when zoom breaks 1:1 (>2% off).
- [ ] 1.4 Workbench: tab order Media · Report · Devices; library
      list-first (big thumbs, names only, lucide sort icons); shared
      adjustable column split + divider collapse toggle; panels keep
      240px on-screen at mount/resize.
- [ ] 1.5 OCR column-gap splitting (side-by-side UI no longer reads
      as one line) + 2D text-box hover cards on This Device.
- [ ] 1.6 Today 22:29 batch: crop as dropdown with Reference size
      directly below (fitted widths); report details flush to column
      bottom; selecting a box scrolls its list row into view;
      keyframe markers hover-scale; prev/next keyframe buttons by the
      loop toggle.

## 2. Carry-over: still awaiting verification from v3

- [ ] 2.1 (4.3) LMB select/pan: 4px drag threshold, double-click
      recenters, measure mode exempt.
- [ ] 2.2 (5.5) Scan status line + post-scan links.
- [ ] 2.3 (5.7) Media panel batch (scan boxes on media, eye toggle,
      header-line buttons, resizable list, split scrolling).
- [ ] 2.4 (6.4) Report names boxes by their OCR text.
- [ ] 2.5 (7.1–7.4) Text grouping: block clustering, group-corrected
      sizes, tint dots; paragraph + all-caps test case.

## 3. Open design/process items

- [ ] 3.1 (6.5) Selected device's details beside This Device's in the
      report — see 5.6 below (built overnight).
- [ ] 3.2 (11.4) Per-device media assignment — spec written up in chat
      2026-08-17, awaiting Taylor's read.
- [ ] 3.3 (12.2) Fresh-state smoke test gate before the next dev →
      main promotion.
- [ ] 3.4 (1.9) Console hygiene — documented upstream noise, no
      app-side action.
- [ ] 3.5 (11.6) Shareable setup links — deferred (implies shared
      data). (11.7) licensing — separate session.

## 4. Overnight build: debug overlays (topic 10, all approved)

All four BUILT overnight behind the new "overlays" menu chip in the
2D toolbar (next to color vision). Verify:

- [ ] 4.1 (10.3) TV safe areas: SMPTE action-safe 93% (white dashed) /
      title-safe 90% (amber dashed) frames on every device rect,
      labeled on rects wide enough.
- [ ] 4.2 (10.1) Contrast badges: Otsu text-vs-background estimate per
      scanned box; WCAG ratio in the detection list (green ≥4.5 AA,
      amber ≥3 large-text AA, red below). Static images only — video
      keyframe rows show an unavailable dash.
- [ ] 4.3 (10.4) Sub-acuity warning: red triangle on detection rows
      (This Device) and report device chips when cap-height < 7′
      (stroke ≈ cap/7 → below the 1′ limit). Always on — it is a
      warning, not an overlay.
- [ ] 4.4 (10.2) Pixel loupe: cursor-following 8× magnifier over This
      Device's rect — pixel grid, amber crosshair, source-px + "1px ≈
      N′" readout. Static images only.

## 5. Overnight build: approved backlog (topic 11) + report tweak

All BUILT overnight. Verify:

- [ ] 5.1 (11.2) Credit-card calibration: Settings → "Calibrate
      screen size…" — match the on-screen card outline (slider or
      edge drag) to a real card; Apply writes the implied diagonal to
      This Device. Warns when browser zoom would skew it.
- [ ] 5.2 (11.5a) EXIF/metadata strip on static-image import (canvas
      re-encode, same MIME; GIFs/videos untouched; falls back to the
      original bytes if encoding fails).
- [ ] 5.3 (11.5b) Non-linear viewing-distance slider in the device
      editor (log scale 10–400cm; cm stepper unchanged; >400cm pins
      the thumb).
- [ ] 5.4 (11.3) CONFIRMED already shipped: measure boxes render in
      the 3D world as curvature-aware outlines on each screen. Call
      out if the intent was baked-into-texture instead.
- [ ] 5.6 (6.5) Report: selecting a device splits the bottom spec
      strip — This Device baseline left, selection right.

## 6. Notes for the morning

- Everything lands on dev via `--no-ff` feature merges, gated on
  typecheck / lint / bun test each time.
- v0.3.1 is still what's live on Pages; dev is far ahead — promotion
  only on Taylor's go.
