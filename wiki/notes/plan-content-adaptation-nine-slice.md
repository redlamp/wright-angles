---
tags: [domain/display-math, status/open]
---

# Plan: Content Adaptation (9-Slice and Per-Box Behaviour)

**Date:** 2026-08-20 · **Status:** open — long-term, explicitly not
scheduled. Raised by Taylor alongside
[[decision-media-crop-vs-device-fit]].

## The gap this closes

Fit modes (contain / fill-width / fill-height) treat a screenshot as a
flat picture: scale it, maybe crop it. Real game UI does none of that.
Ship a 16:9 layout on a 32:9 ultrawide and the game does not letterbox
— it **re-lays-out**: the HUD stays pinned to the corners at its
authored size, the dialogue box takes the extra width or stays centred,
and only the world view actually gets wider.

So the fit modes are a deliberately crude approximation. They are
honest about *angular size*, which is the tool's job, but dishonest
about *layout*, which is what a UX designer is actually judging.

## Sketch

- **9-slice the frame.** Mark border regions that keep their authored
  size while the centre stretches — so HUD elements anchored to edges
  hold their real pixel size across aspect ratios instead of scaling
  with the image.
- **Per-box behaviour.** The measure boxes already exist and already
  carry OCR text. Let the user select a box (the dialogue panel, say)
  and give it its own response rule: pin to an edge, stay centred,
  scale with the frame, or hold authored size.
- The result is a per-device *simulated layout* rather than a scaled
  screenshot — and the arc-minute readings would then describe what
  players would really see.

## Why it waits

- It needs the fit-mode model landed first; this is the sophisticated
  version of the same question.
- Per-box rules need a UI that does not overwhelm the measure workflow.
- Boxes are currently normalized to the full intrinsic image — a
  layout model means boxes acquire anchors, which is a real change to
  [[decision-arcminute-rosetta-stone]]'s "same content across devices"
  guarantee. Worth thinking through before any code.

## Open questions

- Does a 9-slice belong to the media (authored layout) or the device?
  Probably the media — it describes how *that build's UI* was made.
- Do anchored boxes still measure the same content across devices, or
  does each device get its own resolved layout to measure?
