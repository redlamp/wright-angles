# Test Plan — v0.3.0 Ship + Media Debug Track (2026-08-17)

Supersedes [[test-plan-2026-08-15-v2-sprint]] for new work; its Round 4
items (input types, shadows, grab cursors, shaded mannequin) still
apply if unticked.

## v0.3.0 acceptance (live at redlamp.github.io/wright-angles)

- [ ] Site deploys and loads clean from the v0.3.0 merge; no console
      errors; OCR assets load from `/wright-angles/ocr/` (fully local).
- [ ] Comparison table: sortable, CSV export, sub-retina PPD flags.
- [ ] Crop: presets + freeform; crop respected by 2D, 3D texture UVs,
      measure boxes, OCR mapping, and export.
- [ ] OCR inspector: scan → numbered outlines + per-line rows (text,
      px, confidence, This-Device arcmin); row click → measure box.
- [ ] GIF + video: single master decode, transport (play/pause, seek,
      loop) drives 2D and 3D identically.
- [ ] Stance × input matrix: all 9 combos pose sensibly; standing desk
      appears only for Standing + Mouse & KB.
- [ ] Stance order reads Standing · On a couch · At a desk (dev,
      post-v0.3.0).

## Media debug track — pushing past plain OCR

The active-media gateway idea ([[design-active-media-gateway]]) grows
into a debug toolset driven by the CONTENT of the loaded image/video.
Proposed stages, roughly in dependency order:

### Stage 1 — OCR results become first-class overlays

- [ ] Persist scan results per media item (IndexedDB, keyed by media +
      crop) so a scan survives panel close/reopen and reload.
- [ ] Overlay toggle in the 2D view itself (not just the library
      panel): boxes drawn over the true-scale image.
- [ ] Verdict coloring: each line tinted by its arcmin verdict for a
      chosen reference device (≥20′ ok / 16–20′ caution / <16′ fail),
      switchable between devices.
- [ ] Multi-select lines → batch-create measure boxes.

### Stage 2 — Legibility matrix & report

- [ ] Line × device matrix: every OCR line's arcmin on every visible
      device, worst offenders surfaced first.
- [ ] Summary verdict per device ("12 of 40 lines under ISO minimum at
      couch distance").
- [ ] Export the audit (CSV / markdown) alongside the PNG export.

### Stage 3 — Video timeline debugging

- [ ] Scan the CURRENT FRAME at the playhead (engine canvas is already
      the single decode source — feed it to the OCR worker).
- [ ] Frame results stamped with timestamp; a strip of scanned frames
      to jump between.
- [ ] Track one region (e.g. subtitles) across scans to see size
      changes over time.

### Stage 4 — Beyond text (rank these)

- [ ] Contrast probe: text-vs-background luminance sampled from pixels
      per OCR box → WCAG ratio flags (research already in
      [[platform-accessibility-guidelines]]).
- [ ] Pixel loupe: hover magnifier showing source pixels with a px +
      arcmin ruler at each device's distance.
- [ ] TV safe-area overlays (5% action/title safe) on the media.
- [ ] Sub-acuity detail warning: strokes/gaps under 1′ at distance
      (edge-detection pass).
- [ ] Color-vision simulation (protan/deutan/tritan) on active media.

## Other candidate areas (carry-over + new)

- [ ] Browser-zoom ≠ 100% warning (1:1 silently wrong).
- [ ] Credit-card calibration for true PPI.
- [ ] Measure boxes mirrored into the 3D screen texture.
- [ ] Per-device media assignment + hot-zone switching (PRD).
- [ ] Shareable setup links (URL hash).
- [ ] Keyboard shortcuts; EXIF strip; non-linear distance slider.
- [ ] Pose polish: gamepad and couch-lap wrist targets after Taylor
      flips through the matrix.
- [ ] Process: return to feature branches (`feature/<name>` → dev).
- [ ] Licensing decision for the repo (open since v0.1).

## Open questions for Taylor

1. Which Stage 1–4 items matter most for the AAA-studio workflow?
2. Verdict coloring: default reference device = This Device, or the
   currently selected device?
3. Video scanning: on-demand per frame only, or auto-scan at a cadence
   (every Nth second) with a progress readout?
4. Should OCR results feed the perception report ("smallest text in
   this shot is X′ on device Y")?
