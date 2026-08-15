---
tags: [domain/legibility, origin/external-research, status/draft]
---

# Handheld Device Dimensions

Full body dimensions vs display area for the handhelds Wright Angles
should render at true scale. Gathered 2026-08-15. Status is draft
because three rows (Legion Go, iPhone 16 Pro, Galaxy S24) could not be
traced to the owner's page — Lenovo, Apple support, and Samsung all
blocked/404'd fetches — and rest on GSMArena-grade secondaries.

## The table

Body is W×H×D mm as held in landscape (phones listed portrait-style
H×W×D as their makers do). Screen-to-body for the gaming handhelds is
**my math** (16:9 or 16:10 rectangle area ÷ frontal body area);
phone ratios are GSMArena's. *Starred Switch weights are console-only
(Nintendo lists .66/.71 lbs without Joy-Con); Switch 2's 534 g includes
Joy-Con 2.

| Device | Body (mm) | Weight | Screen | Resolution | Screen-to-body |
|---|---|---|---|---|---|
| Switch (w/ Joy-Con) | 239 × 102 × 14 | 299 g* | 6.2" LCD | 1280×720 | ~44% |
| Switch OLED (w/ Joy-Con) | 241 × 102 × 14 | 322 g* | 7.0" OLED | 1280×720 | ~55% |
| Switch Lite | 208 × 91 × 14 | 277 g | 5.5" LCD | 1280×720 | ~44% |
| Switch 2 (w/ Joy-Con 2) | 272 × 114 × 14 (25.4 at sticks) | 534 g | 7.9" LCD | 1920×1080 | ~55% |
| Steam Deck LCD | 298 × 117 × 49 | 669 g | 7.0" | 1280×800 | ~41% |
| Steam Deck OLED | 298 × 117 × 49 | 640 g | 7.4" | 1280×800 | ~45% |
| ROG Ally (2023) | 280 × 111 × 21.2–32.4 | 608 g | 7.0" | 1920×1080 | ~43% |
| Legion Go (w/ controllers) | 299 × 131 × 41 | 854 g | 8.8" | 2560×1600 | ~57% |
| iPhone 16 | 147.6 × 71.6 × 7.8 | 170 g | 6.1" OLED | 2556×1179 (460 ppi) | 86.8% |
| iPhone 16 Pro | 149.6 × 71.5 × 8.3 | 199 g | 6.3" OLED | 2622×1206 (460 ppi) | 90.1% |
| Galaxy S24 | 147 × 70.6 × 7.6 | 167–168 g | 6.2" AMOLED | 2340×1080 (416 ppi) | 90.9% |

Sources per row:

- **Switch family** — [Nintendo US tech specs](https://www.nintendo.com/us/switch/tech-specs/)
  (first-party; gives inches: 9.4/9.5/8.2" long, 4.0/3.6" high, 0.55"
  deep; weights .66/.71/.61 lbs — mm/g above are my conversions).
- **Switch 2** — [Nintendo US Switch 2 tech specs](https://www.nintendo.com/us/gaming-systems/switch-2/tech-specs/)
  (first-party: 10.7 × 4.5 × 0.55 in with Joy-Con 2, 1.2 in max at
  sticks; 1.18 lbs with controllers; "7.9-inch wide color gamut LCD,
  1920x1080").
- **Steam Deck LCD / OLED** — [Valve tech specs](https://www.steamdeck.com/en/tech)
  (first-party: "298mm x 117mm x 49mm"; 669 g / 640 g; 7" 1280×800 /
  7.4" 1280×800).
- **ROG Ally** — [ASUS spec page](https://rog.asus.com/us/gaming-handhelds/rog-ally/rog-ally-2023/spec/)
  (first-party: "28.0 x 11.1 x 2.12 ~ 3.24 cm", 608 g, 7" FHD).
- **Legion Go** — Lenovo pages blocked; figures via
  [XDA](https://www.xda-developers.com/lenovo-legion-go/) and
  [Retro Catalog](https://retrocatalog.com/retro-handhelds/lenovo-legion-go)
  (consistent across secondaries: 299 × 131 × 41 mm, 854 g with
  controllers, 8.8" QHD+ 144 Hz).
- **iPhone 16** — [Apple specs](https://www.apple.com/iphone-16/specs/)
  (first-party); ratio from [GSMArena](https://www.gsmarena.com/apple_iphone_16-13317.php).
- **iPhone 16 Pro** — [GSMArena](https://www.gsmarena.com/apple_iphone_16_pro-13315.php)
  (Apple lists depth 8.25 mm; GSMArena rounds to 8.3).
- **Galaxy S24** — [GSMArena](https://www.gsmarena.com/samsung_galaxy_s24-12773.php);
  matches a [university-hosted copy of Samsung's spec sheet](https://www.cuit.columbia.edu/sites/default/files/content/Samsung%20Galaxy%20S24%20Specifications.pdf).

## What the numbers say

- **Handheld consoles are ~41–57% screen; phones are ~87–91%.** A
  Steam Deck is a 298 mm-wide, 49 mm-thick slab whose front is 59%
  not-screen — render the body, not just the panel, or the sim wildly
  misstates how big these devices feel in a room.
- **Generational drift is screen-growth-in-place**: Switch → OLED kept
  the body (+2 mm) and grew the panel 6.2" → 7.0" (44% → 55%);
  Deck LCD → OLED same body, 7.0" → 7.4". Bezels, not bodies, are the
  variable.
- **Resolution per inch varies widely** across the class: Deck LCD is
  ~215 ppi, Switch OLED ~210 ppi, while Ally packs 1080p and Legion
  Go 2560×1600 into similar hands. At a 40 cm hold (my math): Deck
  LCD ≈ **59 PPD** and Switch OLED ≈ **58 PPD** — right at the 60 PPD
  acuity saturation line ([[visual-acuity-and-ppd]]) — vs Switch 2
  ≈ 77 PPD and Legion Go ≈ 94 PPD. Same-px UI text is physically
  much larger on a Deck than on a Legion Go.

## What this implies for Wright Angles

- Device presets need **body W×H plus screen diagonal + aspect**, not
  just the panel: the body rectangle is what makes the true-scale
  render honest, and D (14 mm Switch vs 49 mm Deck) matters if the
  tool ever draws perspective.
- Xbox's mobile floor is DPI-linear ([[game-accessibility-text-size]]):
  18 px @100 DPI → on Deck LCD (~215 ppi) that's ~39 px, on an iPhone
  16 (460 ppi) ~83 px. Wiring this table's ppi values into that rule
  gives per-device pass/fail lines for free.
- The 720p Switch family sits *below* 60 PPD at hold distance —
  individual pixels are resolvable, so the tool's sub-retina warning
  ([[visual-acuity-and-ppd]]) will actually fire on real, popular
  hardware, not just contrived setups.

Related: [[visual-acuity-and-ppd]], [[game-accessibility-text-size]],
[[tv-market-sizes-and-distances]].
