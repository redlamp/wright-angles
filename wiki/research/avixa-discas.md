---
tags: [domain/legibility, origin/external-research, status/verified]
---

# AVIXA DISCAS

ANSI/AVIXA V202.01:2016 — *Display Image Size for 2D Content in
Audiovisual Systems* (formerly ANSI/INFOCOMM V202.01). The AV
industry's standard for sizing displays from viewing distance and
content. Core constants verified against AVIXA's own
[Learn More About Display Size](https://www.avixa.org/standards/discas-calculators/discas/learn-more-about-display-size)
page and [calculators](https://www.avixa.org/standards/discas-calculators/discas/both);
the full standard text is paywalled.

## The two viewing categories

- **BDM — Basic Decision Making**: viewers comprehend and act on
  content (read a slide, a dashboard) without needing to resolve every
  pixel. **Acuity Factor = 200** (AVIXA: "a constant derived from the
  Visual Acuity standards formulas").
- **ADM — Analytical Decision Making**: viewers must inspect
  pixel-level detail (CAD, imaging, video QC). **Acuity Factor = 3438**.

## %Element Height (%EH)

AVIXA's definition: "The height of an element in relation to the
overall Image Height ... the ratio of element height to screen height
expressed as a percentage." The *element* is the smallest thing that
must be read — typically lowercase text height. Typical content runs
%EH 1–3 (dense spreadsheet ≈ 1, presentation slide ≈ 2–3).

## The math (constants verified; rearrangement mine)

- **BDM: Farthest Viewer distance = 200 × element height.**
  AVIXA's published viewing-ratio table matches exactly: viewing ratio
  (distance ÷ image height) 0.80–1.00 requires %EH ≥ 0.50; ratio
  9.00–10.00 requires %EH ≥ 5.00 — both rows reduce to FV = 200 × EH.
  In angular terms the element subtends 1/200 rad = **≈17.2 arcmin**
  at the farthest allowed viewer.
- **ADM: Farthest Viewer = (Image Height ÷ vertical resolution) × 3438**,
  i.e. FV = 3438 × pixel height. 3438 ≈ arc minutes per radian
  (180×60/π = 3437.75), so this places the farthest viewer where **one
  pixel subtends exactly 1 arcmin** — the 20/20 resolution limit from
  [[visual-acuity-and-ppd]], equivalently 60 PPD.

## What this implies for Wright Angles

- DISCAS is the industry-standard corroboration that both of the
  tool's core readouts are the right ones: BDM is the *text* threshold
  (17.2 arcmin — right between ISO's 16 minimum and 20–22 comfort band,
  [[iso-hfes-character-height-standards]]), ADM is the *pixel* threshold
  (1 arcmin/px = the retina boundary).
- The %EH framing is resolution-independent — element height as % of
  screen height — which is exactly the right input when a user knows
  their content but not the panel. Worth supporting as an input mode:
  %EH + screen size + distance → arcmin.
- Citable line for the UI: "AVIXA DISCAS places the farthest viewer at
  200× element height for basic decision making."

Related: [[extron-video-wall-font-size]] (same worst-case-viewer
method, looser numbers), [[arc-minute-spreadsheet]].
