---
tags: [domain/legibility, origin/external-research, status/draft]
---

# TV Market Sizes and Distances

What TV people actually own and how far they actually sit — the inputs
Wright Angles' TV presets should default to. Market data is
industry-press and analyst-summary grade, not standards grade; per-item
confidence is flagged. Gathered 2026-08-15.

## What sizes actually sell

- **Weighted average shipped LCD TV display size crossed 50 inches for
  the first time in May 2023** (50.2"; was 46.8" in Aug 2022, 49" Dec
  2022) — [Omdia via PR Newswire](https://www.prnewswire.com/apac/news-releases/omdia-for-the-first-time-lcd-tv-display-weighted-average-size-surpasses-the-50-inch-display-size-301883953.html)
  (fetched; high confidence). Omdia put the average at
  [**52 inches by Sept 2023**](https://omdia.tech.informa.com/blogs/2023/nov/the-weighted-average-size-of-shipped-lcd-tv-displays-shifted-to-52-inches-in-september-2023)
  (title/summary only, page blocked; medium confidence). Growth
  concentrates in the fab-economics sizes: 55/85" (Gen 8.5) and
  65/75" (Gen 10.5).
- **65-inch is repeatedly called the most popular size in the US**; the
  56–65" segment took ~40.8% of the 2024 North America smart TV market
  per a [market-research summary](https://www.marketdataforecast.com/market-reports/north-america-smart-tv-market)
  (low confidence — commercial market report, directional only).
- **Ultra-large is the growth story**:
  [Circana](https://www.circana.com/post/new-circana-research-highlights-surge-in-ultra-large-tv-purchases-despite-stagnant-market-sales)
  (June 2024; via search snippets, page truncated on fetch — medium
  confidence): 75"+ unit sales **+21% YoY in Q1 2024** (revenue only
  +4% — markdowns), average screen size **+0.8 in (+2%)** in the first
  four months of 2024, driven by owners replacing the 2018–2020 65"
  boom on a 5–6-year cycle. Omdia headlines agree:
  [80"+ shipments +24.5% YoY in 4Q24](https://omdia.tech.informa.com/pr/2025/feb/omdia-global-tv-sets-market-sees-strong-growth-in-4q24-driven-by-oled-and-80-inch-plus-lcd-sales)
  and a [forecast +44% for 80"+ units 2025→2029](https://omdia.tech.informa.com/pr/2025/sep/omdia-global-shipments-of-80-inch-and-larger-tvs-to-rise-44percent-between-2025-to-2029)
  (both titles/snippets only, pages 403 — medium confidence).
- **Japan skews smaller**: the 30–50" band was ~62% of 2024 TV revenue
  per a [Grand View horizon summary](https://www.grandviewresearch.com/horizon/outlook/television-market/japan)
  (low confidence); budget 43" sets are a marquee segment there. No
  solid EU size-mix source found — gap. Amazon best-seller listings
  were unreachable (503) — no directional evidence captured.

## How far people sit

- **Lechner distance ≈ 9 ft (~2.7 m)**: Bernard J. Lechner (RCA)
  surveyed North American living rooms and found viewers sit about
  9 ft from the screen; the EBU's 2.7 m test distance pays homage to
  it, and Europe has an equivalent "Jackson distance" (~3 m). Sources:
  [SVG profile "He Went the Distance"](https://www.sportsvideo.org/2014/04/28/he-went-the-distance/)
  (via snippet; page 403) and
  [Wikipedia: Optimum HDTV viewing distance](https://en.wikipedia.org/wiki/Optimum_HDTV_viewing_distance).
  The research was never formally published — hence this note is draft.
  [Sound & Vision](https://www.soundandvision.com/content/screen-size-and-seating-distance)
  still treats 9 ft as the average US couch distance.
- **THX** (2006 CES, per
  [Wikipedia](https://en.wikipedia.org/wiki/Optimum_HDTV_viewing_distance)):
  best seat subtends **40°** (distance = diagonal ÷ 0.84 ≈ 1.2×
  diagonal); the back row should stay ≥ **28°**.
- **SMPTE 30°** is the other widely quoted angle, commonly attributed
  to SMPTE EG-18-1994 — but Wikipedia notes "there seems to be no
  direct recommendation from SMPTE on the issue"; treat the
  attribution as folklore with a real number attached.

## The geometry that falls out (my math)

A 65" 16:9 panel is 56.65" wide. At 9 ft (108"):

- Viewing angle = 2·atan(28.33/108) ≈ **29.4°** — the modal US setup
  (65" at Lechner distance) lands almost exactly on SMPTE's 30°, and
  nowhere near THX's 40° (that would need a ~90" panel, per
  [Sound & Vision](https://www.soundandvision.com/content/screen-size-and-seating-distance),
  or sitting at 6.4 ft).
- 4K device px ≈ **0.47 arcmin** → ~**128 PPD**, more than double the
  60 PPD acuity saturation point ([[visual-acuity-and-ppd]]) — at real
  couch distances, 4K resolution is never the legibility bottleneck;
  layout px budget is.
- A 1080p-layout px ≈ 0.94 arcmin, so Fire TV's 28 px body floor
  ([[tv-ui-text-guidelines]]) ≈ **26 arcmin** on this setup —
  comfortably above the ISO 20–22 arcmin comfort band
  ([[iso-hfes-character-height-standards]]). The floors only start
  failing on smaller/farther panels.

## What this implies for Wright Angles

- Default TV preset: **65" at 9 ft / 2.7 m** — both numbers are
  defensible as "the most typical US living room". Offer 55" (the
  other volume size), 75–85" (the growth segment), and 43" (budget/JP)
  as canned alternatives.
- Distance presets deserve named lines: Lechner 9 ft, THX 40°, SMPTE
  30° — the tool can annotate the current sim as "you're at 29°, ≈
  SMPTE cinema angle".
- The average-size trend (~+1"/yr, 46.8" → 52" in 13 months) means
  presets should be revisited yearly; bake the source dates into the
  UI copy.

Related: [[visual-acuity-and-ppd]], [[tv-ui-text-guidelines]],
[[avixa-discas]], [[handheld-device-dimensions]].
