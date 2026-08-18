---
tags: [domain/product, status/draft, origin/taylor]
---

# Plan — Per-Device Cropping

Taylor (2026-08-19): "we may need device-by-device cropping options —
come up with a plan for how that can be done and how it'd work with
the media crop options. We can build it later."

## The problem it solves

One media item shown on five screens today gets ONE crop. But real
work is responsive: the TV shows the full 16:9 frame while the Switch
build letterboxes, or a phone target shows a 9:16 slice of the same
comp. Per-device crops let each screen present the region that device
would actually show, from one source image.

## Model

Two layers, composing in a fixed order:

1. **Media crop** (exists): `item.crop`, normalized to the intrinsic
   image. The authoring statement "this is the content region of this
   file". Stays exactly as-is — OCR, boxes, texture windows, and
   export already flow through it.
2. **Device crop** (new): `item.deviceCrops?: Record<deviceId, MediaCrop>`,
   normalized to the intrinsic image as well (NOT relative to the
   media crop). "On this device, show this window." Absent entry =
   inherit the plain media crop — zero migration, zero behavior
   change for existing libraries.

Why full-image-normalized for both: boxes and scans are already
stored against the intrinsic image precisely so crops can change
without invalidating them; device crops must obey the same rule or
every measurement needs a per-device transform.

Effective crop for rendering on device D:
`effectiveCrop(item, D) = item.deviceCrops?.[D.id] ?? cropOf(item)`.

## Where it touches the code

- `lib/media-crop.ts`: `effectiveCropFor(item, deviceId)` helper next
  to `cropOf`; everything else keeps calling `cropOf` for the
  device-independent case.
- **2D rects** (`display-area`): each rect already contain-fits
  `effectiveDims` — swap to the per-device effective crop per rect.
  BoxLayer's `boxInCrop` gets the same crop per rect (boxes stay
  full-image, so they keep landing on the same pixels).
- **3D screens** (`scene-view`): today ONE texture is shared with the
  crop baked into repeat/offset. Per-device crops need per-device
  repeat/offset — cheapest is one texture object per distinct crop
  (clone shares the GPU image; repeat/offset live on the Texture), so
  N devices with two distinct crops = two texture objects, not N.
- **Perception report / metrics**: `boxMetricsOnDevice` already takes
  normalized heights; the per-device *visibility* question ("is this
  box inside D's crop?") reuses `boxInCrop` with D's effective crop —
  a box can be green on the TV and simply absent on the phone slice.
- **Export view**: draw each rect through its own effective crop
  (the canvas path already crops per draw call).

## UI

- The crop dropdown in the Media Library grows a scope control once a
  device is selected: "All devices" (edits `item.crop`) vs
  "<Selected device>" (edits `deviceCrops[id]`) — riding the now
  app-wide selection. Editing overlay is unchanged; it just writes to
  a different slot.
- A device-crop chip/dot on rows or the crop row indicates "this
  device overrides the media crop", with a clear-override action.
- Aspect presets work identically in device scope (largest centered
  window of that ratio).

## Open questions for Taylor

- Should OCR run per device crop (scan the TV's region separately),
  or stay global with per-device visibility filtering? (Plan assumes
  the latter — cheaper and boxes stay shared.)
- Does a device crop imply the device's own aspect by default (auto
  aspect-crop to the device's ratio as the starting override)?
  Probably yes — one click from "show me what fits this screen".
- Interaction with 11.4 (per-device media assignment): if a device
  can hold its own *item*, a device crop is the lightweight sibling.
  Build order matters; crops likely first.

## Estimate

Model + helpers + 2D + report visibility ≈ a half-day; 3D texture
cloning + export + UI scope control ≈ another half-day. No migration.
