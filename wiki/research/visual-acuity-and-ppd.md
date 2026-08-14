---
tags: [domain/legibility, origin/external-research, status/verified]
---

# Visual Acuity and PPD

Why arc minutes are the right unit: they're how visual acuity itself is
defined.

## Snellen 20/20 = 1 arc minute

Source: [Visual Acuity, StatPearls / NCBI Bookshelf](https://www.ncbi.nlm.nih.gov/books/NBK564307/).

- The Snellen chart dates to 1862 (Herman Snellen, Dutch
  ophthalmologist); test distance 20 ft / 6 m.
- 20/20 (6/6) vision: the viewer "can differentiate 2 objects that cast
  a visual angle of 1 minute" — **1 arcmin is the resolvable-detail
  threshold** for normal acuity.
- **5-arcmin optotype convention:** the full height of a 20/20 Snellen
  letter subtends **5 arc minutes** at the nodal point of the eye —
  letters are built on a 5×5 grid whose strokes/gaps are the 1-arcmin
  detail. (Same convention in ISO 8596's Landolt C: 1-arcmin gap in a
  5-arcmin ring — not fetched, standard is paywalled.)

Bare acuity (5 arcmin) is far below comfortable reading size — reading
standards land at 16–22 arcmin ([[iso-hfes-character-height-standards]]).
Acuity answers "can it be resolved at all", not "is it comfortable".

## Pixels per degree and the ~60 PPD "retina" threshold

- 20/20 = 1 arcmin per resolvable detail ⇒ a display saturates normal
  acuity at **1 pixel per arc minute = 60 pixels per degree (PPD)**.
  This is arithmetic on the Snellen definition, not a separate standard.
- Apple's Retina claim, from the [iPhone 4 press release, 2010-06-07](https://www.apple.com/newsroom/2010/06/07Apple-Presents-iPhone-4/):
  "The resulting 326 pixels per inch is so dense that the human eye is
  unable to distinguish individual pixels when the phone is held at a
  normal distance." At ~10–12 in, 326 PPI works out to ≈ 57–68 PPD
  (my computation), i.e. the marketing claim is the 60 PPD threshold in
  disguise.
- PPD depends on distance: PPD = PPI × distance × tan(1°) — a panel has
  no PPD of its own.
- Some acuity is hyper: vernier alignment and aliasing artifacts are
  detectable well past 60 PPD, so 60 PPD is a text-legibility saturation
  point, not a hard perceptual ceiling.

## What this implies for Wright Angles

- The tool already computes arcmin/px ([[arc-minute-spreadsheet]]);
  PPD is the same number inverted (PPD = 60 / arcmin-per-px). Cheap to
  surface both.
- 60 PPD is a natural "retina boundary" readout: below it, individual
  pixels are resolvable and anti-aliasing quality starts to matter to
  the legibility verdict.
- A useful derived stat: font arcmin ÷ 5 ≈ the Snellen acuity a viewer
  needs to *resolve* the text (e.g. 10-arcmin text ≈ readable detail
  only for ~20/40-or-better viewers at that distance) — worth flagging
  as an estimate, since real-font legibility ≠ optotype resolution.

Related: [[extron-video-wall-font-size]], [[wcag-css-reference-pixel]],
[[avixa-discas]] (its ADM limit is exactly "1 pixel = 1 arcmin").
