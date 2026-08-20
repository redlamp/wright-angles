---
tags: [domain/product, status/superseded]
---

# Test Plan — 2026-08-19 — Per-Device Crop + Mirrored-Side Hover

> **Closed 2026-08-20** → [[test-plan-2026-08-20-device-fit]]. Section 1
> (mirrored-side hover, shipped in v0.6.0) passed and stands. Sections
> 2–4 are void: the feature they test was rejected on review and
> replaced by device fit modes.

Built overnight on dev (v0.6.0 already promoted to main before this).
Tick what passes; annotate anything that feels off.

## 1. Mirrored-side text hover (shipped in v0.6.0)

- [x] 1.1 In 3D, orbit BEHIND a screen showing scanned media (mirrored
      text). Hovering a text line pops the hover card, right-reading,
      placed off the screen space — same as from the front.
- [x] 1.2 From the front, box hover behaves exactly as before.

## 2. Per-device crop — basics

> **Sections 2–4 are void (2026-08-20).** Taylor rejected the approach
> on review; see [[decision-media-crop-vs-device-fit]]. Don't tick
> these — the device-scope crop UI is being replaced by device fit
> modes. Section 1 still stands.

Select a device (row, 2D, or 3D — selection is shared), then Media
Library → Crop.

- [ ] 2.1 With a device selected, an "applies to" control appears
      under the crop dropdown: All devices · `<device>` (hollow dot =
      no override yet).
- [ ] 2.2 In device scope, the dropdown offers: Inherit · Full frame
      on this device · Match W:H (the device's shape) · standard
      aspects · Custom.
- [ ] 2.3 Picking one (e.g. 32:9 on the TV) letterboxes ONLY that
      device in 2D and 3D; every other screen keeps the media crop.
      The dot fills; "N per-device" appears by the Crop label.
- [ ] 2.4 The preview's crop window wears the device's key color in
      device scope; dragging it edits the override (drag an INHERITED
      window → an override is born). All-devices scope still edits
      the shared media crop in white.
- [ ] 2.5 Inherit clears the override; the device falls back to the
      media crop.

## 3. Per-device crop — boxes, report, export

- [ ] 3.1 Scanned/measure boxes render only on screens whose
      effective crop contains them (2D + 3D), at the same pixels.
- [ ] 3.2 Perception Report: a box outside a device's crop shows a
      muted dash chip ("outside this device's crop") instead of a
      verdict; box outline colors (worst-case) ignore devices that
      don't show the box.
- [ ] 3.3 Export view PNG draws each rect through its own crop.
- [ ] 3.4 Video/GIF: overrides apply per rect in 2D (canvas mirrors)
      and 3D (texture clones); playback stays in lockstep.
- [ ] 3.5 Deleting a device removes its overrides (the "N per-device"
      count drops).

## 4. Decisions taken without you (review these)

- 4.1 OCR stays global; per-device is visibility-only (plan default).
- 4.2 Device scope does NOT auto-apply the device's aspect — it's the
      top preset instead ("Match 16:9 — this device's shape").
- 4.3 A full-frame override is kept as an explicit override when a
      media crop exists; with none it normalizes to Inherit.

## 5. Filed, not built

- Issue #2: auto-OCR images on import (debounced) + a plan needed for
  timeline OCR (options sketched in the issue).
