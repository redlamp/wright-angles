---
tags: [domain/product, status/open]
---

# Test Plan v9, Calibration Layout Review, Then the Backlog (2026-09-21)

Supersedes [[test-plan-2026-08-21-first-run]] (v7) and
[[test-plan-2026-09-02-review-fixes]] (v8). Neither was ever ticked, 74
open boxes between them, and everything they cover has since shipped in
v0.8.0. So this is after-the-fact QA: a failed check becomes a GitHub
issue, not a release blocker. The old plans stay in the vault for their
step-by-step scripts; this one points at them rather than copying.

Test on `bun run dev` (port 7841) or the live site, `dev` and `main`
carry the same app code today.

**Order.** Section 1 is the first major task and stands alone (~30 min).
Sections 2-4 are the core-promise checks (~30 min). Sections 5-7 are
"if time" and some need hardware.

## 1. The calibration panel layout, never reviewed

This is the layout proposal waiting on you. It is the panel behind
**Settings → Calibrate screen size**, and behind **"I don't know my
screen size"** in onboarding. The Settings panel itself has not been
re-laid-out since 2026-08-18; if the proposal you remember was something
else, say so and section 1 gets rewritten.

### What was proposed, and what you said last time

You reviewed a first pass on 2026-08-20 and left five notes. The redesign
answered them in two commits and then you left, nobody has looked since.

| Your note (2026-08-20) | What was built |
|---|---|
| Font sizes are tiny; use the default size, not small/x-small | Label on the app's normal type scale, no computed pixel sizes |
| cm/in toggle should be consistent with the other examples | Same `SegmentedToggle` as everywhere, wired to the global unit; new `onFill` color mapping so it reads on the solid card |
| "I think this display is:" goes to the top, under the zoom warning, above the card | Moved there |
| Keep a slider for scale; allow diagonal scaling | Slider re-added; four corner handles, opposite corner pins |
| Pills are overused; match the device editor's common resolutions | Restyled as the device editor's resolution chips, configured size highlighted |

**Two layouts exist.** On dev (`23aa101`): name, "dimensions", the
measurements and the cm/in toggle all sit **on the card face**. The
alternative (`163e5a2`): the card carries only the name, and the
measurements and toggle sit in the **readout row** beneath it. Ask and
I'll serve `163e5a2` from a worktree on a second port so the two can be
compared side by side.

### 1A. First impression, do this before reading the checks

Open Settings → Calibrate screen size. Look for ten seconds, touch
nothing.

- [ ] 1.1 Reading order top to bottom makes sense: zoom warning (if any)
      → "I think the display is:" chips → card stage → slider / readout
      → apply.
- [ ] 1.2 Nothing is tiny. The card label and the readouts read as peers
      of the rest of the app's type.
- [ ] 1.3 It is obvious what to do with a bank card without reading the
      instructions twice.

Notes:

### 1B. The card

- [ ] 1.4 The card is a **solid block**: hold a real card against it;
      no border-versus-fill question.
- [ ] 1.5 Card face: name → "dimensions" → measurements → **cm/in
      toggle**. The toggle is legible on the fill in **both themes**
      (flip the theme in Settings and look again).
- [ ] 1.6 The toggle drives the GLOBAL unit, the Media Library and
      device rows agree afterwards.
- [ ] 1.7 Below ~190px card width the whole label block hides together.
      Judged acceptable at the time; does it annoy you in practice?

### 1C. Resizing

- [ ] 1.8 Each of the **four edges** drags; the opposite edge pins.
- [ ] 1.9 Each of the **four corners** drags diagonally; the opposite
      corner pins.
- [ ] 1.10 The **slider** scales the card from its center.
- [ ] 1.11 Keyboard: edge handles take focus, arrows resize, Shift for
      ten at a time.
- [ ] 1.12 Start an edge drag, Alt+Tab away and back: the card is not
      still resizing on hover, cursor is normal (v8 fix).

### 1D. The chips

- [ ] 1.13 "I think the display is:" looks like the device editor's
      resolution chips, not pills; the configured size is highlighted.
- [ ] 1.14 Picking one applies it directly.

### 1E. Fit

- [ ] 1.15 The dialog fits on screen, on the 5120×1440, on a laptop,
      and in a window dragged down to roughly 1280×720.
- [ ] 1.16 With This Device set to 27″/4K the true-size card (~550 CSS
      px) is reachable by drag or by scrolling the stage.

### 1F. Entry points

- [ ] 1.17 Clean profile (private window): onboarding step 1 shows
      **"I don't know my screen size"** above the preset select, as an
      offer rather than a footnote, not competing with Next.
- [ ] 1.18 It opens calibration inline, no dialog stacked on a dialog;
      and applying returns to step 1 with the diagonal filled in.
- [ ] 1.19 Settings → Calibrate screen size opens the same panel.
- [ ] 1.20 Settings → "Run setup assistant again" after editing This
      Device shows the **edited** values; Done and Skip both keep them.

### 1G. Verdict

- [ ] 1.21 Card layout: **keep card-face** / switch to readout-row
      (`163e5a2`) / rework. This closes old decision 8.
- [ ] 1.22 While you are in Settings: the panel's own sections (Setup,
      Units, Theme, 3D scene, Readouts, Storage), anything you want
      regrouped? Nothing was proposed; this is just the moment to say.

Notes:

## 2. First run, clean profile

- [ ] 2.1 The seeded gradient card already shows its text detections and
      arc-minute readouts with nothing clicked.
- [ ] 2.2 Skipping onboarding still leaves a usable app.
- [ ] 2.3 DevTools → Network, third-party filter: nothing leaves the
      machine, including during an OCR scan.
- [ ] 2.4 Boot again with existing data, the restore path is different
      code from the seed path.

## 3. The numbers agree

The v8 headline: one path from a box to its arc minutes. Full script in
v8 §2.1-2.3.

Setup: crop the gradient card to its center half; one device on
fill-width, one on fill-height.

- [ ] 3.1 Perception Report chip = 2D overlay hover readout, for both
      devices.
- [ ] 3.2 Media Library OCR list shows the same figures.
- [ ] 3.3 Cropped readings are roughly double the uncropped ones.
- [ ] 3.4 A box cropped off every visible device renders **muted
      neutral**, not green.
- [ ] 3.5 Pinned [[arc-minute-spreadsheet]] rows: Switch Lite 22px ≈
      20′, Switch 22px ≈ 23′, 24″ 1080p 17px ≈ 23′.

## 4. Interrupted gestures and bad imports

- [ ] 4.1 Start a 2D pan, Alt+Tab mid-drag, come back: no panning on
      hover, cursor not stuck on "grabbing".
- [ ] 4.2 Same for a floating panel's header drag and a resize handle.
- [ ] 4.3 Import one good PNG plus a `.txt` renamed `.png`: a
      dismissible banner names the bad file, the good one imports.
- [ ] 4.4 Dismiss, import a clean batch: the banner does not come back
      with old names.

## 5. Focus, OCR, hands, if time

- [ ] 5.1 ↑/↓ cycles device focus and wraps; ←/→ still cycles media;
      both stand down inside inputs, sliders, dropdowns and modals.
- [ ] 5.2 2D: the focused device's outline and label rise, its FILL does
      not, a phone nested in a TV is never occluded.
- [ ] 5.3 3D: focus hides and dims nothing.
- [ ] 5.4 Import ten screenshots: per-row spinners, N of M banner, UI
      stays responsive; Cancel remaining drops the queue.
- [ ] 5.5 Video/GIF scans t=0 only.
- [ ] 5.6 Handheld stance: hands below the screen's center line,
      gripping not pinching; elbows tucked; the nearer of two equal-
      height handhelds is the one held.

## 6. 3D camera, if time

Full 15-step script in v8 §2.16. The ones that matter:

- [ ] 6.1 Wheel over the far projector: converges on the projector, not
      screen center.
- [ ] 6.2 Plain left-drag: the old orbit, no marker.
- [ ] 6.3 Ctrl+left-drag on the Deck's face: marker at the click, fixed
      on screen while the world turns; gone on release; no jump.
- [ ] 6.4 Ctrl+drag on the couch or figure: pivot snaps to the model's
      base, it turns in place.
- [ ] 6.5 Ctrl+drag upward hard from the floor: stops at the horizon, no
      flip, no snap on release.
- [ ] 6.6 Distance handles still drag the device, with or without Ctrl.
- [ ] 6.7 Double-click the ground: flies back to the default orbit pose.
      Double-click a device: nothing.
- [ ] 6.8 Orbit somewhere odd, resize the window, Tab to 2D: the head-on
      pose lines up, no jump.

## 7. Needs hardware or patience, optional

- [ ] 7.1 Two monitors at different OS scaling: drag the window across;
      scale chip and zoom warning update without a resize.
- [ ] 7.2 Firefox: PNG export from 2D, from 3D, and setup JSON all
      download.
- [ ] 7.3 20+ media switches in 3D with Task Manager's GPU memory open:
      plateaus, does not climb per switch.
- [ ] 7.4 Scrub a video with the Perception Report open: no stutter.

## 8. Decisions waiting on you

Carried from v7 §9 and v8 §4, minus what resolved itself (promotion,
push, Bun 1.4). Answer by number; my lean in brackets.

1. **Card layout**: check 1.21 above.
2. **Firefox zoom warning** (#9), confirmed by measurement. [One pure
   `lib/` check returning ok / zoomed / unverifiable; Firefox gets
   "unverifiable, press Ctrl+0", not a green light.]
3. **Zoom compensation** (#10), [decision note after #9 lands; build
   for Chromium/WebKit only.]
4. **Wizard fingerprint** (#8/#5), [defer to the wizard plan review.]
5. **Distance without a tape measure** (#4), [worth a design session;
   the most user-facing playtest item.]
6. **OCR follow-ups** (#11), [leave filed.]
7. **Parked flags** (#1), [remove pinned devices and column collapse,
   keep 3D body parked.]
8. **PRD rewrite** (#13), needs your read; `CLAUDE.md` treats it as
   source of truth.

## 9. Process notes

- The browser pane in agent sessions could not composite the canvas in
  August, so nothing visual here has been seen by anyone. That is why
  section 1 leads.
- Testers stay unnamed in anything checked in, the repo is public.
