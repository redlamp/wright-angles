---
tags: [domain/product, status/open]
---

# Review 2026-08-15 — Open Questions

Written at the end of the overnight first build, for Taylor's return.
Test steps live in [[test-plan-2026-08-15-first-build]].

## Needs a decision

1. **License.** Repo currently says "all rights reserved" pending your
   call (your 2026-08-14 note). MIT if you want portfolio-friendly and
   permissive; PolyForm Noncommercial if you want to keep commercial use
   reserved while staying source-visible. One word from you and I'll add
   the file and README section.
2. **Dev → main promotion.** Everything is merged to `dev` and the Pages
   pipeline is armed; the first deploy fires on your explicit "merge to
   main".
3. **Legibility thresholds in the UI.** Research landed a defensible
   band (ISO 9241-303: 16′ minimum, 20–22′ comfortable; AVIXA: ~17.2′
   for decision-making; Extron: 10′ absolute floor). Where do you want
   these surfaced — in the arcmin readout as color bands, as a dedicated
   "legibility check" tool with the highlight rectangles, or both?
   Caveat from the research: platform px minimums (Xbox 26px@1080p)
   measure full body height while ISO measures cap height — we shouldn't
   compare them naively.

## Judgement calls I made (flag if wrong)

- **Canonical units** are diagonal-inches + distance-cm; the unit toggle
  converts display only. Default display unit: cm.
- **This Device defaults** to 27″ 1440p @ 70cm with three seeded test
  devices (Switch OLED, Switch 2, 49″ TV) so first launch demonstrates
  the idea.
- **2D mapping** letterboxes This Device's screen into the browser
  window (contain-fit); the bottom-right chip shows % of physical scale
  and reads 1:1 fullscreen at native res. Browser zoom must be 100% —
  detecting non-100% zoom is a possible later warning.
- **Image fit** inside each device rect is object-contain (bars if
  aspect differs), like console output — not crop.
- **Highlight rectangles** (text measuring) are **not built yet** — next
  design pass, per the Miro note that they need one.

## Known rough edges

- 3D labels unverified under automation (hidden Chrome suspends WebGL
  frames — see test plan ⚠).
- `next dev` occasionally rewrites AGENTS.md with its agent-rules block;
  harmless, committed as-is.
- Odd Miro/PRD idea not implemented: per-device image assignment and
  URL-referenced (non-uploaded) images. Both are compatible with the
  media store design; say the word.
