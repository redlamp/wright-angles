---
tags: [domain/legibility, origin/external-research, status/verified]
---

# Game Accessibility Text Size

What the game-accessibility world specifies for text size. XAG and GAG
read first-party 2026-08-14.

## Game Accessibility Guidelines ([Use an easily readable default font size](https://gameaccessibilityguidelines.com/use-an-easily-readable-default-font-size/))

- Category: Basic (Vision + Cognitive).
- Concrete floor: **28 px minimum at 1080p**, explicitly borrowed from
  Amazon's TV 10-foot-UI guidelines ([[tv-ui-text-guidelines]]) and tied
  to "20/20 vision while using the Snellen Chart".
- Framing: 28 px is "a minimum rather than a target, aim to exceed it";
  adjustable font size is the ideal solution, a large default the
  fallback.

## Xbox Accessibility Guidelines ([XAG 101: Text display](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101))

Minimum **default** sizes, measured as *body height* (descender bottom
→ ascender top, in px — Microsoft even documents a measure-it-in-Paint
procedure, with a 2:1 contrast rule for which outline pixels count):

- **Console: 26 px at 1080p / 52 px at 4K.**
- **PC/VR: 18 px at 1080p / 36 px at 4K.**
- **Mobile/streaming: 18 px at 100 DPI**, scaling linearly with DPI
  (36 px @ 200 DPI, 72 px @ 400 DPI; a 5.5-inch 1080p phone ≈ 400 DPI).
- Text must scale **up to 200%** of these minimums without loss of
  content or function; icon/glyph text obeys the same minimums; screen
  magnifiers are "not an appropriate mitigation".
- Spacing floors (when not user-configurable): line width ≤ 80 chars
  (40 CJK), line spacing ≥ 1.5, paragraph spacing ≥ 2× line spacing,
  letter spacing ≥ 0.12 em, word spacing ≥ 0.16 em; at least one
  sans-serif option; sentence case for lines of text.

The console-vs-PC split (26 vs 18 px) is Microsoft quantifying the
couch-distance penalty: same physical panel, ~3× the distance, so
+44% px.

## Subtitles: the 46 px number

[Ubisoft's Assassin's Creed Black Flag Resynced accessibility spotlight](https://news.ubisoft.com/en-us/article/759plQmVmAvQySTmxx0r09/assassins-creed-black-flag-resynced-accessibility-spotlight)
ships subtitle sizes up to **46 px at 1080p**, the figure the
accessibility community (via BBC television subtitle practice)
converged on as the comfortable-subtitle size; secondary sources
attribute the 46px@1080p floor to BBC guidelines (not re-verified
against the BBC text itself — the old bbc.github.io/subtitle-guidelines
URL 404s). No public EA first-party text-size number found; EA's
accessibility portal talks principles, not px.

## What this implies for Wright Angles

- Games measure *body height in px at a reference resolution* — a
  different unit from ISO's cap-height arcmin. The tool should convert
  both ways: 26 px body @1080p on a 40-inch/10-ft setup ≈ 13.5 arcmin
  body (my math, see [[tv-ui-text-guidelines]]), i.e. the Xbox console
  floor is *below* the ISO 16-arcmin line for cap height. Surfacing
  that gap is a headline insight for the tool.
- The 200% scaling requirement suggests a tool feature: report not
  just the default's arcmin but the arcmin range the game's text
  scaler can reach.
- The Disco Elysium sheet ([[arc-minute-spreadsheet]]) predates XAG
  but lands at 20+ arcmin — comfortably above these floors; the tool
  can show both bars (XAG floor vs ISO comfort).

Related: [[iso-hfes-character-height-standards]],
[[extron-video-wall-font-size]], [[visual-acuity-and-ppd]].
