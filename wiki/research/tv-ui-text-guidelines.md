---
tags: [domain/legibility, origin/external-research, status/verified]
---

# TV UI Text Guidelines

What the 10-foot-UI platform owners actually specify. First-party pages
read directly 2026-08-14 except where flagged.

## Apple tvOS ([HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography))

Platform default/minimum sizes (HIG legibility table):

| Platform | Default | Minimum |
|---|---|---|
| tvOS | **29 pt** | **23 pt** |
| iOS/iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |

tvOS built-in text styles (@1x, i.e. px at 1920×1080 layout): Body
**29 pt** Medium, Caption 2 23 pt, Headline 38 pt, Title 1 76 pt.
Note tvOS styles default to Medium weight (iOS uses Regular) and the
HIG says to avoid Ultralight/Thin/Light generally — weight is part of
the platform's distance compensation, not just size.

## Google / Android TV ([TV Typography](https://developer.android.com/design/ui/tv/guides/styles/typography))

Current docs give a Material-3-based type scale (Roboto; display/
headline/title/body/label roles) and reason qualitatively: "As
television screens are typically viewed from a distance, interfaces
that use larger typography are more legible" — but publish **no hard
minimum** on the current page. The legacy Android 5.0 TV design guide
recommended **12 sp minimum / 18 sp default** (widely cited; original
page retired — could not re-verify first-party, treat those two numbers
as draft).

## Amazon Fire TV ([Design and UX Guidelines](https://developer.amazon.com/docs/fire-tv/design-and-user-experience-guidelines.html))

- Body text "at least 14sp, which is approximately 19px on 720p,
  **28px on 1080p**" — assuming "the user is viewing the screen from
  10 or more feet away". This is the origin of the 28px number that
  gameaccessibilityguidelines.com cites ([[game-accessibility-text-size]]).
- Keep UI out of the outer 5% of each edge (overscan); focused items
  and text within the inner 90%.

## Consoles

Microsoft's public numbers live in the Xbox Accessibility Guidelines
(console text ≥ 26 px at 1080p — see [[game-accessibility-text-size]]).
No equivalent public first-party text-size spec found for Sony or
Nintendo; their UI requirements are under NDA'd TRC/lotcheck docs.

## Cross-check in arc minutes (my math, 40-inch 1080p panel at 10 ft)

Panel height 19.6 in → 1 px = 0.0182 in; at 120 in distance 1 px ≈
0.52 arcmin. So: Fire TV 28 px ≈ **14.6 arcmin**; Xbox 26 px ≈ 13.5;
tvOS Body 29 px ≈ 15.1. The platforms cluster right on Extron's
15–20 arcmin "safe" floor ([[extron-video-wall-font-size]]) — but note
these are *body* px including ascender/descender space; cap-height
arcmin is ~30% lower, so they sit nearer the ISO 16-arcmin minimum than
the 20–22 comfort band.

## What this implies for Wright Angles

- The tool's TV presets should assume ~3 m / 10 ft and can annotate
  measured text with "meets/misses Fire TV 28px@1080p, tvOS 29pt
  defaults" alongside the raw arcmin number.
- Platform defaults are floors tuned for 20/20-ish viewers on ~40–65"
  panels; the same px count on a smaller or farther TV silently drops
  below the ISO band — exactly the failure mode Wright Angles exists to
  expose.

Related: [[iso-hfes-character-height-standards]], [[avixa-discas]],
[[visual-acuity-and-ppd]].
