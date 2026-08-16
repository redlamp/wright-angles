---
tags: [domain/product, status/draft]
---

# Design: Active Media as the Measurement Gateway

**Date:** 2026-08-15 · **Status:** draft, for Taylor's feedback

## Taylor's direction

> "the active media feature become a gateway to measuring and
> monitoring the sizing of content"

## What's already converged there

The Active Media detail (Media Library, right column) has organically
accumulated the content-side tools: name, measurements block, reference
size, crop (presets + freeform), transport for video/GIF, and — landing
now — OCR text detection that turns text lines into measure boxes.
Meanwhile the measurement *outputs* live elsewhere: measure mode is a
2D-toolbar chip, box verdicts render in the Perception Report.

## Proposal

Make the split intentional: **content in, verdicts out.**

1. **Active Media = everything about the content itself**: framing
   (crop), timing (transport), identity (name/reference size), and
   detection (OCR, future edge/contrast probes). Add a "Measure" button
   here that jumps to 2D + enables draw mode, so the gateway actually
   gates: you start measuring from the content, not from a toolbar chip
   you must know about.
2. **Perception Report = everything about how it reads per device**:
   box list with verdicts, probe, ratios. Unchanged role.
3. Rename "Media Library" panel → "Content" once the gateway framing
   sticks (defer; naming churn is cheap later).

## Monitoring (the second half of Taylor's phrase)

Not built; candidate shape: a per-box "watch" flag. Watched boxes get a
persistent status strip (smallest passing device / worst arcmin) that
stays visible as content, crop, reference size, or devices change —
turning one-off measurements into standing checks. Pairs naturally
with OCR re-runs when the active image changes.

## Open questions for Taylor

- Should measure mode auto-enable when the Active Media section is
  focused/open, instead of a button?
- Do watched boxes belong in the export (CSV/PNG annotations)?
- OCR on video: run on the current poster frame, or on demand per
  scrubbed frame?
