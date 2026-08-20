---
tags: [domain/product, status/open]
---

# Test Plan v5 — Morning Review (2026-08-19)

Written while you slept (01:34 go-to-bed). Housekeeping done tonight:
v3/v4 and both 08-15 plans are closed out — everything exercised
through your live loops is ticked there, with notes. What's left is
this one plan: the overnight build, the release check, and the small
standing backlog.

## 1. What shipped while you were away

- **v0.6.0 → main** (your go-ahead): Device Manager slimming, unified
  selection, parked flags, the U-mirror timing fix, mirrored-side
  hover. Pages deploy green.
- **Per-device crop overrides** → dev only, awaiting your review.
- Issues filed: #1 (flagged-features review), #2 (auto-OCR on import
  + timeline-OCR plan, your 00:44 request).

## 2. Main course: per-device crops

Work through [[test-plan-2026-08-19-per-device-crop]] — it has the
full checklist (scope control, override behavior, boxes/report/
export, video/GIF, delete-pruning) plus section 4: three decisions I
took using the plan note's own defaults. Call out any you want
reversed; none are load-bearing.

## 3. Release spot-check (v0.6.0 live)

- [ ] 3.1 https://redlamp.github.io/wright-angles/ boots clean in a
      fresh profile: instant 3D rest pose, five starter devices,
      seeded gradient, onboarding prompt, no rail panels.
- [ ] 3.2 Your real machine (stored state): everything where you left
      it — devices, media, panels, 2D/3D mode.

## 4. Standing open items (the whole backlog, deduped)

- [ ] 4.1 (11.4) Per-device media assignment — spec from 2026-08-17
      chat still awaits your read. Crops shipped first as its
      lightweight sibling; if 11.4 is a go, the crop scope UI is the
      natural place to hang it.
- [ ] 4.2 Issue #2 needs your ranking: is auto-OCR next, and which
      timeline option (A: manual only / B: scan t=0 / C: scene-change
      proposals)?
- [ ] 4.3 Issue #1: revisit the three parked flags when you have an
      opinion (3D bodies, pinned devices, column collapse).
- [ ] 4.4 Licensing follow-up: code is MIT (LICENSE in repo root since
      v2). v3's 11.7 flagged a separate licensing session anyway —
      confirm whether anything beyond the code license was meant
      (sample media? vendored OCR?), or close it.
- [ ] 4.5 Sub-retina (<60 PPD) indicator per device — never approved;
      approve, park, or kill.
- [ ] 4.6 Shareable setup links — stays deferred unless you say
      otherwise.

## 5. Process notes

- dev is 3 merges ahead of main (mirrored hover shipped in v0.6.0;
  per-device crops + wiki housekeeping are dev-only). Next promotion
  on your word, gates + fresh-origin smoke as always.
- 108 tests green; typecheck/lint clean at every merge.
