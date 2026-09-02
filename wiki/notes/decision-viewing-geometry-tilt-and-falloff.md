---
tags: [domain/display-math, status/adopted]
---

# Decision: Screens Tilt, and Distance Varies Across a Panel

**Date:** 2026-08-20 · **Status:** adopted

## Context

Two gaps in how the 3D scene models a real viewing setup, raised by
Taylor 2026-08-20:

- **Every screen is face-on.** `device-rect.tsx` places each rect at
  `[0, centerY, distanceCm]` with no rotation at all, and its own
  comment admits it: *"Rotation stays face-on even when off the sight
  line."* But a handheld is tilted so you look straight into it, while
  a desk monitor sits near eye level tilted up only slightly. Elevation
  without tilt makes an elevated screen look wrong.
- **Distance is one number per device.** On a flat 32:9 the edges of
  the panel are meaningfully farther from the eye than the centre, so
  the same UI element does not subtend the same angle across the
  screen. The app currently cannot show that. (It is the reason curved
  panels exist.)

## Decision

### Tilt

- Devices gain a **pitch (tilt) angle**, stored **per stance** next to
  the existing per-stance `elevation`, since a monitor is met at a
  different angle from a desk chair than from a couch.
- An **auto-orient checkbox** pitches the screen to face the viewer's
  eye directly. On means there is nothing to set; off reveals the
  per-stance tilt sliders.
- Auto-orient defaults **on for handheld, phone, and tablet** (you hold
  them, so they turn with your gaze) and **off for monitor, TV, and
  projector**.

### Screen height UI

All three stance heights (standing · desk · couch) become visible and
editable **at once**, rather than only the stance currently active in
the 3D HUD. Tilt sits alongside each.

### Distance falloff

- `distanceCm` stays the **screen-centre** distance and stays the basis
  for the headline arc-minute figure.
- A **per-point distance** is derived from panel geometry, tilt, and
  curvature, and surfaces two ways, each independently toggleable:
  - a **hover readout** giving distance and local arc-minute scale at
    the point under the cursor, in 2D and 3D;
  - a **falloff overlay** shading the panel by distance so the whole
    gradient and the far corners read at a glance.
- Measurement reporting shows **centre plus variance**: the canonical
  number, and what the same element costs where it actually sits
  ("23 arcmin · 19 at that spot").

## Why

- Tilt is scene realism *and* measurement truth: an off-axis panel is
  foreshortened and genuinely subtends less.
- Per-stance tilt mirrors per-stance elevation, so the two controls
  stay conceptually paired instead of drifting.
- Centre-plus-variance is the only framing that adds honesty without
  moving the canonical number — see the constraint below.

## Constraints carried forward

- **The pinned sheet must not move.** [[arc-minute-spreadsheet]] gives
  one `Dist (cm)` per device, measured at screen centre, and
  `lib/display-math.test.ts` pins to its rows (Switch Lite 20, Switch
  23, 24″ 1080p 23). Per-point distance is *additive*: at offset zero
  the geometry reduces to `distanceCm`, so the pinned rows compute
  unchanged. Any implementation that shifts them is wrong.
- Exact subtense `2·atan(s/2d)` still applies, now with a `d` that can
  vary per point.
- Every new behaviour here is **toggleable off** (Taylor, explicit).
  The default view must stay as calm as it is today.
- `elevation`'s type comment currently says the angular math assumes a
  centred gaze and elevation is scene-realism only. Once tilt feeds the
  math, that comment needs rewriting rather than quietly contradicting
  the code.
