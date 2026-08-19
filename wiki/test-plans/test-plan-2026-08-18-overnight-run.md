# Test Plan v4 — Overnight Run Review (2026-08-18)

Numbered for call-outs, same as [[test-plan-2026-08-17-v3-media-debug]]
(old numbers in parens). Everything Taylor didn't respond to today
carries over; the overnight build queue lands under topics 5–6.
Taylor reviews in the morning.

> **Closed 2026-08-19** (per Taylor, before bed): items exercised and
> iterated through the 08-18/08-19 live review loops are marked done —
> most evolved further under his direction (inspector → hover cards,
> collapse toggle → parked behind a flag, crop dropdown → per-device
> scope). Still open: 3.2 (11.4 spec awaiting his read) and 3.5
> (deferred by design). Open items carry to
> [[test-plan-2026-08-19-morning-review]].

## 1. Carry-over: built earlier today, needs Taylor's eyes

- [x] 1.1 (3.1–3.3) Device inspector — iterated live 08-18/19 into the
      inspector + box hover-card pair (selection pins, full alpha on
      hover/selection); Edit link now selects + opens the Devices tab.
- [x] 1.2 (10.5) Color-vision simulation — dropdown reworked live
      (own line, wide popup, right-aligned descriptions, top-right
      toolbars in both views); exercised by Taylor.
- [x] 1.3 (11.1) Zoom chip — verified live in the 2026-08-19 smoke
      run (chip showed at 200% zoom with the correct caption).
- [x] 1.4 Workbench — tab order/list-first/shared split all iterated
      live; the divider collapse toggle was PARKED behind
      FEATURE_COLLAPSE_FIRST_COLUMN (issue #1) on 08-19.
- [x] 1.5 OCR column-gap splitting + hover cards — hover cards
      redesigned twice under Taylor's direction (box-anchored,
      off-screen placement); gap splitting has pinned tests.
- [x] 1.6 22:29 batch — all exercised in later loops; crop dropdown
      since grew the per-device scope control.

## 2. Carry-over: still awaiting verification from v3

- [x] 2.1 (4.3) LMB select/pan — verified through daily use; the same
      4px click-vs-drag rule was extended to 3D selection at Taylor's
      request on 08-18.
- [x] 2.2 (5.5) Scan status line + post-scan links — exercised across
      many scan sessions; report link kept, table link retired with
      the workbench redesign.
- [x] 2.3 (5.7) Media panel batch — all iterated live since.
- [x] 2.4 (6.4) Report names boxes by OCR text — carried through the
      08-18 row redesign (label row + dot·arcmin row).
- [x] 2.5 (7.1–7.4) Text grouping — group sizes/tints now flow
      through list, report, hover cards, and 3D outlines; pinned
      tests cover the clustering.

## 3. Open design/process items

- [x] 3.1 (6.5) Selected device's details beside This Device's in the
      report — see 5.6 below (built overnight).
- [ ] 3.2 (11.4) Per-device media assignment — spec still awaiting
      Taylor's read; its lightweight sibling (per-device CROPS)
      shipped 08-19 as the plan note argued.
- [x] 3.3 (12.2) Fresh-state smoke gate — standing practice; ran for
      the v0.4.0, v0.5.0, and v0.6.0 promotions (clean origin on
      port 7842, never the live 7841 storage).
- [x] 3.4 (1.9) Console hygiene — closed as documented; upstream
      noise only.
- [ ] 3.5 (11.6) Shareable setup links — stays deferred by design.
      (11.7) licensing — still its own session.

## 4. Overnight build: debug overlays (topic 10, all approved)

All four BUILT overnight behind the new "overlays" menu chip in the
2D toolbar (next to color vision). Verify:

- [x] 4.1 (10.3) TV safe areas — verified after the overlays-chip
      z-order fix (Taylor's "no visual change" report, 08-18).
- [x] 4.2 (10.1) Contrast badges — verified working in the detection
      list post-fix; video rows show the unavailable dash.
- [x] 4.3 (10.4) Sub-acuity warning — now also on the text hover
      card (⚠ with tooltip); exercised through the hover-card loops.
- [x] 4.4 (10.2) Pixel loupe — verified post-fix; now reads through
      This Device's EFFECTIVE crop (per-device crop build, 08-19).

## 5. Overnight build: approved backlog (topic 11) + report tweak

All BUILT overnight. Verify:

- [x] 5.1 (11.2) Credit-card calibration — Taylor placed it in the
      Settings "Setup" section during his 08-18 settings reorder;
      flow shipped with the zoom warning.
- [x] 5.2 (11.5a) EXIF/metadata strip — shipped with unit tests;
      exercised by every import since.
- [x] 5.3 (11.5b) Log distance slider — carried into the Device
      Manager editor redesign (icons + labels, 08-19).
- [x] 5.4 (11.3) Curvature-aware 3D box outlines confirmed as the
      intended behavior — no objection raised; now per-device-crop
      aware too.
- [x] 5.6 (6.5) Report split spec strip — exercised through the
      report loops.

## 6. Notes for the morning

- Everything lands on dev via `--no-ff` feature merges, gated on
  typecheck / lint / bun test each time.
- ~~v0.3.1 is still what's live on Pages~~ → v0.4.0, v0.5.0, and
  v0.6.0 have since shipped on Taylor's go-aheads; v0.6.0 is live.
