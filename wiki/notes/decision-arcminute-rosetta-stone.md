---
tags: [domain/display-math, status/adopted]
---

# Decision: Arc Minutes Are the Rosetta Stone

**Date:** 2026-08-14 · **Status:** adopted

## Context

Wright Angles compares displays across wildly different sizes and viewing
distances (a 5.5″ Switch Lite at 36cm vs a 65″ TV at 3m). Pixels, inches,
and PPI all fail to transfer between those situations. The angle a thing
subtends at the eye is the only unit that does: two things with equal
angular size look equally big.

Taylor used exactly this approach to set the three main font sizes for
Disco Elysium: The Final Cut on console and handheld — see
[[arc-minute-spreadsheet]].

## Decision

Every measurement in the app converts through arc minutes:

- A device's screen → horizontal/vertical/diagonal subtense (arcmin) at
  its viewing distance.
- A font or UI element → pixels → physical mm on that panel → arcmin.
- The 2D overlay → each device rendered on This Device at *equal angular
  size* (`simulatedSizeOnHostPx` in `lib/display-math.ts`).

Reference thresholds (ACUITY const): 1 arcmin ≈ 20/20 detail limit,
~15 arcmin floor for critical text, ~20 arcmin comfortable.

## Why

- Transfers across every device class with no special cases.
- Matches the workflow that shipped a real AAA title.
- Gives accessibility guidance a physical basis instead of "looks fine".

## Constraints carried forward

- Exact subtense (`2·atan(s/2d)`), not the small-angle shortcut — the
  difference matters for handhelds held close.
- Aspect ratio must be honored: prior attempts computed the diagonal's
  subtense only ([[prior-wright-angles-attempts]]); width and height must
  be derived separately.
- Tests in `lib/display-math.test.ts` are pinned to the sheet's numbers;
  changing the math means explaining the sheet first.
