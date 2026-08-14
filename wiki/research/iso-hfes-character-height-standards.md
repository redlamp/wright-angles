---
tags: [domain/legibility, origin/external-research, status/draft]
---

# ISO HFES Character Height Standards

The ergonomics standards that put hard arcmin numbers on character
height. **status/draft**: both standards are paywalled; numbers below
are traced to sources *quoting* the standards, not to the standard text
itself. Consistent across multiple independent citations, but buy/borrow
the text before treating clause wording as gospel.

## ISO 9241-303 (Requirements for electronic visual displays)

- Clause 5.5 (per [UXMA's quote of DIN EN ISO 9241-303:2012](https://uxma.com/en/insights/tool-based-accessibility)):
  "The minimum height of Latin characters shall be 16 arc minutes; it
  is required that the system is capable of providing a character
  height of 20 arc minutes to 22 arc minutes."
  - **Minimum: 16 arcmin. Required capability: 20–22 arcmin.**
- Search-result snippets of the standard's preview add: viewing
  distances of 400–750 mm "require character heights that subtend
  between 20′ to 22′ of arc" for most people.
- Lineage: ISO 9241-3:1992 (VDT displays) → ISO 9241-303:2008 → :2011.
  The 16 / 20–22 arcmin numbers persist across editions.
- Official catalogue page: [ISO 9241-303:2011](https://www.iso.org/standard/57992.html).

## ANSI/HFES 100-2007 (Human Factors Engineering of Computer Workstations)

- Commonly cited with the same numbers: character height ≥ 16 arcmin
  minimum for legibility, 20–22 arcmin preferred for reading tasks.
  Not yet traced to the purchased text — treat as corroboration of the
  ISO values, not an independent verified source.

## Sanity checks (my math)

- 20 arcmin at 70 cm (desktop) = 70 × tan(20/60°) ≈ **4.1 mm**
  character height — matches the sheet's 1080p-PC row (4.7 mm ⇒ 23′)
  in [[arc-minute-spreadsheet]].
- Character height in these standards = the height of the actual glyph
  (capital height for the classic measure), not the font's nominal
  point/em size — em size overstates rendered height, so a naive
  px-based check will read high.

## What this implies for Wright Angles

- These are the strongest citable thresholds for the tool's bands:
  **< 16 arcmin = fails the ISO minimum; 20–22 arcmin = the comfort
  target**. Extron's 15–20 ([[extron-video-wall-font-size]]) and the
  Disco Elysium sheet's ~20 targets bracket the same zone.
- The 16 vs 20–22 split maps cleanly onto amber vs green in
  [[decision-arcminute-rosetta-stone]] threshold flagging.
- The tool should be explicit about *which* height it measured
  (cap height vs full body height) when comparing against these
  numbers — see the measurement procedure in
  [[game-accessibility-text-size]] (Xbox measures ascender-to-descender
  body height, a different quantity).

Related: [[visual-acuity-and-ppd]], [[avixa-discas]].
