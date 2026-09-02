---
tags: [domain/product, status/open]
---

# Test Plan v7 — First Run, Focus and Auto-OCR (2026-08-21)

Supersedes [[test-plan-2026-08-20-device-fit]]; its section 8 backlog is
carried forward whole as section 8 here, minus what shipped. Everything
below is on `dev`. Main is still at v0.7.0 — promotion is question 1.

Work is tracked in GitHub issues from today onward. This plan is for
your QA pass; the issues hold the state.

## 1. What landed since you last tested

Three branches merged this evening, all triggered by playtest feedback
that a first-time user stalled on the calibration step and never found
the text-detection feature at all.

- **Calibration** (`2456ee2`, closed #3) — reachable from first run,
  redesigned card, dialog no longer overflows.
- **Arrow navigation** (`662b29c`, closed #6) — Up/Down cycles device
  focus, chrome-only emphasis.
- **Auto-OCR** (`ee113a6`, closed #2) — imported images scan themselves,
  the seeded card ships its detections precomputed.

Plus, earlier today and already on dev: the handheld grip drops to a
real hand position, and two handhelds at equal height break the tie by
nearness.

Gates at merge: typecheck, lint, 204 tests, production build. Fresh-state
smoke passed (onboarding boots, canvas renders, clean console).

## 2. First run — the whole point of the round

Test this on a **clean profile** (clear localStorage + IndexedDB), since
that is the state the feedback came from.

- [ ] 2.1 Onboarding step 1 shows **"I don't know my screen size"** ABOVE
      the preset select, as a secondary button with a ruler icon. It
      should read as an offer, not a footnote — and not compete with
      Next.
- [ ] 2.2 It opens calibration inline, without a second dialog stacking
      on the first.
- [ ] 2.3 Measuring and applying returns you to step 1 with the diagonal
      filled in, so you can see what changed.
- [ ] 2.4 The whole dialog fits on screen. Measured 1216×669 in a
      1280×720 window; check your own laptop and an external monitor.
- [ ] 2.5 Skipping still works and still leaves a usable app.

## 3. The calibration card

- [ ] 3.1 **Type sizes.** This is the note you raised — the label is on
      the app's normal scale now, no computed pixel sizes. Check it reads
      as a peer of the rest of the UI.
- [ ] 3.2 The card is a **solid block**. Hold a real bank card against
      it; there should be no question of aligning to a border versus a
      fill.
- [ ] 3.3 Drag each of the **four edges** — the opposite edge pins.
- [ ] 3.4 Drag each of the **four corners** — the opposite corner pins,
      and the card scales diagonally.
- [ ] 3.5 The **slider** scales the whole card from its centre.
- [ ] 3.6 The card face carries name → "dimensions" → measurements →
      **cm/in toggle**, and the toggle drives the GLOBAL unit setting
      (check the Media Library agrees afterwards).
- [ ] 3.7 Below 190px card width the whole block hides together,
      including the toggle. Judged acceptable — a card that small means
      you are mid-drag — but see whether it annoys you in practice.
- [ ] 3.8 **"I think the display is:"** sits at the top, under the zoom
      warning, styled as the device editor's resolution chips, with the
      configured size highlighted. Picking one applies it directly.
- [ ] 3.9 A 27″/4K card is around 550 CSS px — confirm it is reachable,
      by drag or by scrolling the stage, or calibration is impossible on
      that panel.
- [ ] 3.10 Keyboard: the edge handles focus and arrow keys resize, Shift
      for ten at a time. The slider was dropped and re-added; the arrows
      are what covers anyone without a pointer.

## 4. Device focus

- [ ] 4.1 **↑ / ↓** cycles the focused device among the visible ones,
      wrapping at both ends. **← / →** still cycles media.
- [ ] 4.2 In **2D**, the focused device's outline, ring and label rise
      above the stack — but its FILL does not, so nested devices are
      never occluded. Test with a phone nested inside a TV, focusing
      each in turn.
- [ ] 4.3 Click and hover still reach the smallest rect under the
      cursor, including deep inside a large focused device.
- [ ] 4.4 In **3D**, nothing changes about the other devices. No hiding,
      no dimming.
- [ ] 4.5 Arrow keys stand down inside inputs, sliders, open dropdowns
      and modals. This was broken before today for ← / → as well, so it
      is worth a real poke.
- [ ] 4.6 The `?` cheat sheet lists the new keys.

## 5. Auto-OCR

- [ ] 5.1 On a **clean profile**, the seeded gradient card already shows
      its text detections and arc-minute readouts with nothing clicked.
      This is the payoff a first-run user was never reaching.
- [ ] 5.2 Import a screenshot: it scans itself, no button press.
- [ ] 5.3 Import ten at once: per-row spinners, a batch banner counting
      N of M, and the UI stays responsive.
- [ ] 5.4 **Cancel remaining** drops the queue. The scan already running
      finishes — that is deliberate and tracked as #11.
- [ ] 5.5 Video or GIF scans **t=0 only**; every other frame stays
      manual.
- [ ] 5.6 The manual Detect Text Size button still works for a re-scan
      after a crop edit.
- [ ] 5.7 Nothing hits the network at any point — the whole promise
      depends on it. DevTools → Network, filter to third-party.

## 6. The figure's hands

- [ ] 6.1 Handheld stance: the hands sit **below** the screen's centre
      line, not level with it, and read as gripping rather than pinching
      the top edge. This is the fix for your note; if 4.8cm on a Deck is
      still not enough, it is one constant.
- [ ] 6.2 Elbows tuck toward the ribs rather than winging out.
- [ ] 6.3 Two handhelds at the same height: the **nearer** one is held.
- [ ] 6.4 A handheld well out of reach still points the arms along the
      line to it rather than snapping onto it.

## 7. Regressions worth a glance

- [ ] 7.1 The three pinned [[arc-minute-spreadsheet]] rows still pass —
      Switch Lite 20′, Switch 23′, 24″ 1080p 23′.
- [ ] 7.2 Fit modes and the stretch badge, untouched today but adjacent
      to the calibration work.
- [ ] 7.3 Settings → Calibrate screen size still opens the same panel as
      onboarding does.
- [ ] 7.4 Unit toggles elsewhere agree with the card's toggle.
- [ ] 7.5 Boot with existing data as well as a clean profile — the seed
      path and the restore path are different code.

## 8. Standing backlog — carried forward, still yours to call

- [ ] 8.1 **#4 Distance without a tape measure.** Card at arm's length,
      webcam ranging, or just ask for a tape measure. Unranked.
- [ ] 8.2 **#5 Screen auto-detection.** Research done and it says no
      browser API gives physical size. The open question is whether the
      device-fingerprint confirm is worth building when it does nothing
      for a 1080p desktop user.
- [ ] 8.3 **#7 Bun 1.4.** Runway is clear now. Includes deciding whether
      CI pins an exact version instead of `latest`.
- [ ] 8.4 **#8 The wizard plan** — four open questions in
      [[plan-display-setup-wizard]], three now answered; the fingerprint
      one is 8.2 above.
- [ ] 8.5 **#9 Firefox zoom warning.** Confirmed broken by measurement.
      The fix is a product call about how loudly to degrade.
- [ ] 8.6 **#10 Zoom compensation.** Wants a decision note first; it can
      only work where zoom is measurable, which excludes Firefox.
- [ ] 8.7 **#11 OCR follow-ups** — abort the in-flight scan, dedup
      re-imports.
- [ ] 8.8 **#1 Parked feature flags** — 3D bodies, pinned devices, column
      collapse.
- [ ] 8.9 Per-device media assignment (11.4) — spec still awaits a read.
- [ ] 8.10 Sub-retina (<60 PPD) indicator — approve, park, or kill it for
      the main views.
- [ ] 8.11 Shareable setup links — deferred unless you say otherwise.

## 9. Decisions waiting on you

Numbered so you can answer by number:

1. **Promotion to main.** dev now carries fit modes, offsets/tilt, the
   grip work, calibration, arrow nav and auto-OCR.
2. **Wizard fingerprint** (#8/#5) — build it, or go straight to the card?
3. **Firefox zoom warning** (#9) — browser-sniff a specific message, or
   a permanent unverifiable-state note everywhere?
4. **Zoom compensation** (#10) — decision note now, or park until #9?
5. **Bun 1.4** (#7) — go, or leave it?
6. **Distance** (#4) — worth a session, or park?
7. **OCR follow-ups** (#11) — do either matter, or leave them filed?
8. **Card layout** — you have the card-face version. If the alternative
   reads better in practice, `163e5a2` is still in history.

## 10. Process notes

- The three merged branches were cut from `db0b211`, so `CLAUDE.md`'s
  `merge-base --is-ancestor origin/dev HEAD` check FAILED for all of them
  — benignly, because dev moved on after they were cut. The check that
  still discriminates is `git log --oneline origin/dev..<branch>` showing
  only that branch's own commits. Worth amending the rule in `CLAUDE.md`
  to say so, since it will keep happening.
- The browser pane in these sessions cannot composite frames, so no agent
  could screenshot the canvas. DOM and store contracts were verified
  instead; anything visual in this plan genuinely needs your eyes.
- Testers stay unnamed in anything checked in — the repo is public.
