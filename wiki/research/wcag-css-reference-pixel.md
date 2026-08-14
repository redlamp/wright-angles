---
tags: [domain/legibility, origin/external-research, status/verified]
---

# WCAG CSS Reference Pixel

The web's px is *already* an angular unit — viewing distance is baked
into its definition.

## The definition ([CSS Values and Units Level 4 § reference pixel](https://www.w3.org/TR/css-values-4/#reference-pixel))

Quoted from the spec:

> "The reference pixel is the visual angle of one pixel on a device
> with a device pixel density of 96dpi and a distance from the reader
> of an arm's length. For a nominal arm's length of 28 inches, the
> visual angle is therefore about 0.0213 degrees."

> "For reading at arm's length, 1px thus corresponds to about 0.26 mm
> (1/96 inch)."

Anchoring rule: for screen media the spec recommends anchoring units to
the **pixel unit** (the reference pixel), not to physical inches — on
screens, CSS "inches" are 96 CSS px whatever their physical size.
Device-pixel-ratio exists precisely to keep CSS px near this visual
angle on dense/near or large/far displays.

[WCAG 2.1](https://www.w3.org/TR/WCAG21/) leans on the same definition:
its success criteria (e.g. 1.4.10 Reflow, 2.5.5 Target Size) gloss CSS
pixels inline as "visual angle of about 0.0213 degrees".

## In arc minutes (my conversion)

- 1 CSS px = 0.0213° × 60 = **1.278 arcmin**.
- So nominal CSS sizes convert directly: 16 px default body text =
  **20.4 arcmin** *of em size* — sitting exactly in ISO's 20–22 arcmin
  band ([[iso-hfes-character-height-standards]]), which is presumably no
  accident. Cap height of a typical 16px font (~0.7 em) ≈ 14.3 arcmin.
- WCAG 2.5.5's 44×44 px target ≈ 56 arcmin ≈ 0.94° square.
- The definition assumes the *intended* viewing distance: a phone held
  at 28 inches renders CSS px smaller than 1.278 arcmin; vendors pick
  DPR against their assumed distance, so real-world CSS px drifts from
  the reference angle.

## What this implies for Wright Angles

- CSS px is a natural output unit alongside arcmin: `arcmin / 1.278`
  gives "equivalent CSS px at reference conditions", instantly
  meaningful to web/UI people. The inverse makes the tool a checker for
  whether a device's actual px matches the reference angle at its real
  viewing distance.
- The reference pixel is the precedent for the whole product idea: a
  standards body already normalized length to visual angle. Wright
  Angles generalizes that move to arbitrary screens and distances.
- Beware double-compensation in measurements of web content: CSS px →
  device px via DPR, then device px → mm via panel PPI. The tool's
  pipeline ([[arc-minute-spreadsheet]]) must work in device px + panel
  PPI and treat CSS px only as a reporting layer.

Related: [[visual-acuity-and-ppd]] (1.278 arcmin ≈ resolvable-detail
threshold with margin), [[tv-ui-text-guidelines]].
