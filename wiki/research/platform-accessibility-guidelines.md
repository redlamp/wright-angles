---
tags: [domain/legibility, origin/external-research, status/verified]
---

# Platform Accessibility Guidelines

What the platform owners require *beyond* raw text size — contrast,
scaling, safe areas — plus WCAG 2.2 items that matter at couch distance.
Deepens [[game-accessibility-text-size]] and [[tv-ui-text-guidelines]].
First-party pages read 2026-08-15 except where flagged.

## Xbox: XAG 102 Contrast ([first-party](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102))

Contrast ratio floors (read in full; ms.date 2023-06-08):

| Element | Ratio |
|---|---|
| Standard-size text / visual elements | **4.5:1** |
| Large-scale text and visual elements | **3:1** |
| Inactive-element text | 3:1 |
| Placeholder / input-field text | 4.5:1 (3:1 large) |
| High-contrast-mode elements | **≥ 7:1** |

- "Large" is defined in px, and it's exactly **2× the XAG 101 text
  minimums**: console 52 px @1080p / 104 px @4K; PC/VR 36 px @1080p;
  mobile 36 px @100 DPI scaling linearly with DPI.
- Over a non-solid background, measure against the **lowest-contrasting
  area** of the background — a rule tailor-made for game HUDs.
- Also: read platform high-contrast setting at launch; text must not be
  baked into images (logotypes exempt); decorative elements exempt.

## Xbox: XAG 101 scaling mechanics ([first-party](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101))

Beyond the size floors already in [[game-accessibility-text-size]]:
text must resize **up to 200%** of the minimums without loss of content
or function (26 → 52 px console @1080p), scaled text must never force
scrolling in *both* directions within one UI, and navigation order must
follow the reflowed layout.

## Screen-safe areas (TV overscan)

- **Android TV**: keep UI inside a **5% margin** — concretely
  **48 dp left/right and 27 dp top/bottom** on the 960×540 dp TV layout
  ([Build TV layouts](https://developer.android.com/training/tv/start/layouts),
  read first-party; Leanback fragments apply it automatically).
- **Fire TV**: inner 90% (5% per edge) — already in
  [[tv-ui-text-guidelines]].
- No XAG guideline covers safe area; on Xbox it lives in the NDA'd
  certification requirements.

## Apple: Dynamic Type and vision ([HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility))

Apple's developer pages are an SPA that would not render server-side
today, so these HIG-table numbers were confirmed only via secondary
write-ups (e.g. [DEPT engineering on Dynamic Type](https://engineering.deptagency.com/ios-accessibility-part-1-dynamic-type)) —
treat the specific figures as draft even though the note is verified
overall:

- Dynamic Type has 7 standard sizes plus **5 accessibility sizes
  (AX1–AX5)**; Body goes from **17 pt at the Large default to 53 pt at
  AX5** — a ~310% swing, larger than the 200% Xbox/WCAG/Android ceiling.
- HIG platform minimums (17 pt default / 11 pt min iOS, 29 pt / 23 pt
  tvOS) were verified first-party earlier in [[tv-ui-text-guidelines]].

## Google / Android font & display scaling ([Android 14 features](https://developer.android.com/about/versions/14/features), first-party)

- "Starting in Android 14, the system supports **font scaling up to
  200%**" (previously 130% on Pixel), with a **nonlinear curve**: large
  text scales less than small text so hierarchy survives — which means
  `fontScale` is no longer a single scalar and 4sp + 20sp ≠ 24sp.
- Separate from font scale, Android has a **Display size** (screen
  zoom) setting that scales all dp; both compose on top of TV density.

## PlayStation: nothing public

Sony publishes **no developer-facing text-size or contrast numbers**.
[SIE's Digital Accessibility Standards page](https://sonyinteractive.com/en/impact/accessibility/)
(read 2026-08-15) is commitments only. The public artifact is the
[PS5 store's 50+ accessibility tags across six categories](https://blog.playstation.com/2023/04/03/accessibility-tags-roll-out-this-week-on-playstation-store-on-the-ps5-console/)
(visual, audio, subtitle/caption, control, gameplay, online comms) —
tags describe *that* a game has "large text", never *how large*.
Matches the NDA'd-TRC situation noted in [[tv-ui-text-guidelines]].

## WCAG 2.2 items relevant at distance ([W3C TR](https://www.w3.org/TR/WCAG22/), read first-party)

- **1.4.3 Contrast (Minimum)**: 4.5:1; **3:1 for large text = ≥ 18 pt
  or 14 pt bold**. Same ratios as XAG 102 — Microsoft ported WCAG's
  ratios and re-derived the "large" threshold in px.
- **1.4.4 Resize Text**: up to **200%** without loss — the origin of
  the XAG/Android 200% figure.
- **1.4.8 Visual Presentation (AAA)**: ≤ 80 chars/line (40 CJK), line
  spacing ≥ 1.5, paragraph spacing ≥ 1.5× line spacing — XAG 101's
  spacing floors are these, verbatim.
- **1.4.10 Reflow**: no 2-D scrolling at 320 CSS px width / 256 CSS px
  height.
- **1.4.11 Non-text Contrast**: **3:1** for UI components and graphics.
- **1.4.12 Text Spacing**: must survive line height 1.5×, paragraph
  2×, letter 0.12×, word 0.16× font size.
- **2.5.8 Target Size (Minimum)**: pointer targets ≥ **24×24 CSS px**
  ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- Distance relevance: all CSS-px items inherit the reference pixel's
  baked-in 28-inch viewing assumption ([[wcag-css-reference-pixel]]) —
  WCAG numbers applied to a TV browser silently assume arm's length.

## What this implies for Wright Angles

- Contrast is a **second axis** the tool currently ignores. A cheap,
  high-value add: let a preset carry fg/bg colors and report the ratio
  against the 4.5:1 / 3:1 / 7:1 lines — the thresholds are identical
  across WCAG and XAG, so one implementation covers both badges.
- The large-text 3:1 concession is size-dependent: WCAG flips at 18 pt
  (≈ 24 CSS px ≈ 30.7 arcmin at the reference pixel's 28-in distance,
  my math via [[wcag-css-reference-pixel]]); XAG flips at 52 px @1080p.
  The tool can show *which* contrast floor applies at the simulated
  size — a genuinely non-obvious output.
- Safe-area overlay for TV canvases: 5% per edge is the consistent
  Android TV + Fire TV number; render it as a guide.
- Scaling range is a spec, not a nicety: Xbox/WCAG/Android all say
  **200%**, Apple's AX sizes reach ~310%. The tool should report the
  arcmin band from default to max-scale, not a single point.

Related: [[game-accessibility-text-size]], [[tv-ui-text-guidelines]],
[[iso-hfes-character-height-standards]], [[wcag-css-reference-pixel]].
