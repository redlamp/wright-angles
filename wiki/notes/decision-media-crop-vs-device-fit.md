---
tags: [domain/display-math, status/adopted]
---

# Decision: Source Crop and Display Fit Are Different Features

**Date:** 2026-08-20 · **Status:** adopted · Supersedes the device-scope
half of [[plan-per-device-crop]].

## Context

v0.7.0 shipped per-device crop overrides: a device-scope control in the
Media Library letting you hand-draw a different crop rectangle for each
device. Reviewing the test plan, Taylor rejected the approach — not the
rendering, the *concept*. Two unrelated jobs had been folded into one
control:

- **Fixing the source.** A screenshot has browser chrome in it, or only
  its lower third matters. That is a property of the **media**, decided
  once, true everywhere.
- **Presenting content on a screen whose shape differs.** Most displays
  are 16:9 and most screenshots found online are 16:9, so they usually
  agree. When they don't, something has to give — and *what* gives is a
  property of the **device**, not of the image.

Making the second job a hand-drawn rectangle in the Media Library got
both wrong: it read as editing the source, and it made the user solve
manually what a named mode answers in one click.

## Decision

1. **Media Library crop keeps its original job only** — the source
   image. One crop per item, applied everywhere. No device scope.
2. **Devices gain a `fit` mode** governing what happens when the device
   aspect and the media aspect disagree:
   - `contain` — scale to fit; whole image visible, bars where it
     doesn't reach. **Today's behaviour and the default.**
   - `fill-width` — match the width, crop off top and bottom.
   - `fill-height` — match the height, crop off left and right.
   - `stretch` — scale each axis independently to touch all four edges.
     Nothing cropped, no bars, pixels distorted. **Added 2026-08-20 —
     see the amendment below.**
3. **One fit per device**, not per device-and-media pair. It models the
   hardware: a TV set to fill, fills. A bad pairing is visible on
   screen, so the fix is to change the device, not to maintain a matrix.
4. **The v0.7.0 render pipeline survives.** `fill-width` and
   `fill-height` *are* crops — computed instead of drawn. The per-device
   texture clones, box culling, report chips, and export path all stay;
   only the authoring layer is replaced.
5. **Quick access from the device hover card** — a fit dropdown appears
   above "edit in Device Manager", and only when the aspects actually
   disagree.

## Why

- `contain` was already the behaviour (see
  [[review-2026-08-15-open-questions]]: *"Image fit inside each device
  rect is object-contain (bars if aspect differs), like console output
  — not crop"*). This adds the choice that was always missing rather
  than inventing a model.
- Naming the modes states intent. A drawn rectangle records a result
  and loses the reason, so it silently goes stale when the media
  changes.
- Device-owned fit needs no migration and no second place to look when
  a screen renders oddly.

## Constraints carried forward

- `contain` must remain the default so existing scenes are unchanged.
- `boxMetricsOnDevice` hard-codes the contain assumption in its
  `Math.min(...)` (`lib/display-math.ts:267-288`). Fill modes need the
  matching scale there or the reported arc minutes will contradict what
  is drawn. This is the one place the math actually cares.
- Fit modes reframe; only `stretch` resizes the content itself, and it
  reports the vertical figure (see the amendment).
- Real game UI does not letterbox or crop — it re-lays-out, anchoring
  HUD to edges and reflowing dialogue. Fit modes are the honest crude
  approximation; see [[plan-content-adaptation-nine-slice]] for the
  model that eventually replaces them.

## Amendment 2026-08-20: `stretch` is in, at the user's risk

The original decision excluded an anamorphic mode on the grounds that
distorted pixels make every arc-minute reading a lie. Taylor overruled
it: **"let's add a stretch to fit option, and leave it up to the user's
risk."**

The objection was real but too strict. Stretching is something that
actually happens to shipped work — a TV on the wrong aspect setting, a
game with a broken ultrawide mode — and showing a designer what that
does to their type has value the tool was otherwise refusing to give.

What makes it honest rather than a lie:

- **The reported figure is the VERTICAL arc minutes.** Every
  measurement here is already height-normalized (`boxMetricsOnDevice`
  takes a normalized height; the [[arc-minute-spreadsheet]] pipeline is
  px→mm→arcmin on height), and legibility is height-driven. So stretch
  changes nothing about how the number is computed — it just means the
  number describes one axis of a deliberately non-uniform image.
- **The distortion is surfaced, not hidden.** A stretched device carries
  a badge naming the ratio ("stretched 1.8× wide · arcmin is vertical"),
  so the single number is never mistaken for the whole story.
- Taylor's note on the future: "I think we can add some clever ways to
  handle that" — i.e. [[plan-content-adaptation-nine-slice]], where
  content adapts by layout rather than by deformation, is the real
  answer and stretch is the crude stand-in until then.
