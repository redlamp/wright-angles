---
tags: [domain/product, status/open]
---

# Test Plan v8 — Review Fixes (2026-09-02)

Covers `cd3a6ce` on `dev` — twelve commits from the 2026-09-02 code
review (see [[2026-09-02]]), merged after `833bc32` (CI and Bun 1.4,
not covered here — no QA needed, see section 3). v7 is still listed as
current in [[index]]; it was never QA'd, so its section 2-7 items are
still open alongside this plan.

## 1. What landed

The headline fix is `lib/box-metrics.ts`: one path from a highlight
box to its arc-minute reading, crop and fit mode both included, now
shared by the 2D overlay, the Perception Report, the Media Library OCR
list, and the 3D device rects. Before this they each hand-rolled the
same math and could silently disagree.

- **One box-metrics path** — `boxMetricsInCrop` resolves the device's
  actual rendered crop (source crop + fit-mode crop) before measuring,
  so a box's arc-minute size matches what the device actually shows,
  not the full intrinsic image.
- **Muted verdict for fully-cropped boxes** — a box no visible device
  shows now returns `null` instead of `Infinity`, and renders in a
  muted neutral (`#71717a59`) instead of false-green.
- **Onboarding re-seed** — "Run setup assistant again" now re-seeds
  the draft from This Device on open, instead of showing a stale
  mount-time snapshot that overwrote your edits on Done.
- **Pointer cancel paths** — canvas pan, floating-panel drag/resize,
  and calibration card handles all clear their drag state on
  `pointercancel` (and `lostpointercapture` for pan), not just
  `pointerup`.
- **Surfaced import failures** — unreadable or wrong-type files now
  show a dismissible red banner listing their names instead of
  vanishing silently.
- **Per-record IndexedDB writes** — metadata persistence reads/writes
  one record instead of the whole media library.
- **Setup import validation** — rejects non-finite resolution/aspect/
  diagonal/distance values instead of loading a device that later
  divides by `Infinity` or `NaN`.
- **devicePixelRatio tracks monitor moves** — a `matchMedia` query
  re-arms itself on every DPR change, not just window resizes.
- **Deferred object-URL revoke** — PNG/JSON exports revoke their blob
  URL a second after the click, so Firefox/Safari don't lose the
  download race.
- **Leak/stuck-state cleanup** — 3D base textures dispose on unmount,
  `device-rect`'s body cursor resets on unmount, Media Library's text
  detection guards state after unmount, and the 3D head-on pose now
  subscribes to window resize instead of going stale.
- **Deduped helpers** — legibility color, 2D view-scale, easing, and
  timecode formatting each moved from three or four copies into one
  `lib/` home; `use-theme.ts` moved out of `lib/` into `components/`
  since it's a DOM-touching hook.
- **Perception Report memoization** — text entries and per-device
  verdicts are `useMemo`'d off their real inputs, so scrubbing the
  playhead no longer recomputes them every tick.

Gates at merge: 212 tests (up from 204), typecheck, lint, build.

## 2. Steps

### 2.1 Perception Report vs 2D overlay agreement on cropped media

Preconditions: the seeded gradient card, cropped to its centre half
(50% width, 50% height, centred). One visible device set to
fill-width, another to fill-height.

1. Open the Perception Report and note the arcmin chip for a text
   line on the cropped card, for each device.
2. Hover the same line on the 2D overlay for each device and read the
   hover readout.
3. Uncrop the card (or check against an uncropped duplicate) and note
   the same line's arcmin reading on the same devices.

- [ ] 2.1.1 The report's chip and the overlay's hover readout match
      for both devices.
- [ ] 2.1.2 Both cropped readings are roughly double the uncropped
      reading (cropping to half the frame roughly doubles apparent
      size on a fit that fills to the crop).

### 2.2 Fully-cropped box shows muted, not green

Preconditions: a media item with a highlight box near the top edge.
Every visible device set to a fit mode that crops that edge away
(e.g. fill-height on a wide item, or an aggressive zoom-fit).

1. Confirm the box is not visible on any device under its current fit.
2. Check the box's color in the overlay/list.

- [ ] 2.2.1 The box renders muted neutral (not green, not red) —
      `legibilityColor(null)` in `lib/legibility.ts`, `#71717a59`.

### 2.3 Media Library OCR list agrees

Preconditions: same cropped gradient card as 2.1, with auto-OCR
detections present.

1. Open the Media Library detail card for that item and read its OCR
   results list arcmin figures for the same visible devices.

- [ ] 2.3.1 The figures match the Perception Report and overlay
      readings from 2.1 exactly (same `boxMetricsInCrop` call).

### 2.4 Setup assistant re-seed via Settings

Preconditions: This Device already configured from initial onboarding.

1. In Device Manager, edit This Device's diagonal or distance to a
   new value.
2. Settings → "Run setup assistant again."
3. Check the assistant's first step shows the value you just edited,
   not the original onboarding value.
4. Click Done.
5. Reopen the assistant again — confirm the edited value stuck.
6. Edit again, reopen the assistant, this time click Skip.

- [ ] 2.4.1 Reopening always shows current This Device values, not a
      stale mount-time snapshot.
- [ ] 2.4.2 Done keeps the values shown.
- [ ] 2.4.3 Skip also keeps the values shown (does not revert them).

### 2.5 Pointer cancel — canvas pan

1. Start a 2D pan drag (empty canvas area, drag).
2. Mid-drag, Alt+Tab away (or press the Windows key) and back.
3. Move the mouse over the canvas without clicking.

- [ ] 2.5.1 The view does not keep panning on hover after you return.
- [ ] 2.5.2 The cursor is not stuck as "grabbing."

### 2.6 Pointer cancel — floating panel drag/resize

1. Start dragging a floating panel by its header. Alt+Tab mid-drag,
   return, move the mouse.
2. Repeat for one of the panel's resize handles.

- [ ] 2.6.1 Neither leaves the panel following the cursor or the
      resize cursor stuck after the interrupt.

### 2.7 Pointer cancel — calibration card

1. In the calibration card, start dragging an edge handle. Alt+Tab
   mid-drag, return.
2. Repeat for a corner handle.

- [ ] 2.7.1 The card stops resizing on hover; cursor resets normally.

### 2.8 Import failures surfaced

Preconditions: a mixed batch — one valid PNG, plus one bad file (a
`.txt` renamed to `.png`, or a real `.heic`/other unsupported type).

1. Drag the batch into the Media Library.
2. Check the result.
3. Dismiss the failure banner.
4. Import a second, all-valid batch.

- [ ] 2.8.1 A dismissible banner lists the failed file name(s):
      "N files couldn't be read: name1, name2" (or singular for one).
- [ ] 2.8.2 The valid PNG imports normally alongside the failure.
- [ ] 2.8.3 Dismiss clears the banner.
- [ ] 2.8.4 The banner does not resurrect old names on the next
      (clean) import; a new failing import shows only its own names.

### 2.9 devicePixelRatio across monitors

Preconditions: two monitors at different OS scaling.

1. With the app window on one monitor, note the scale chip and any
   zoom warning.
2. Drag the window to the other monitor without resizing it.

- [ ] 2.9.1 The scale chip updates to the new monitor's DPR.
- [ ] 2.9.2 The zoom warning (if shown) updates too — both without a
      window resize event.

### 2.10 Export downloads in Firefox

1. In Chrome: export PNG from 2D, export PNG from 3D, export setup
   JSON. Confirm all three download.
2. Repeat all three in Firefox.

- [ ] 2.10.1 All three exports download successfully in both browsers
      (deferred blob-URL revoke should no longer race Firefox/Safari).

### 2.11 3D texture memory over a long session

Preconditions: a media library with many images (10+).

1. In 3D, cycle through the library repeatedly (20+ switches) with
   Task Manager's GPU memory column open.

- [ ] 2.11.1 GPU memory does not climb without bound across the
      cycling — it should roughly plateau, not grow every switch.

### 2.12 Device-rect drag cursor across 2D/3D switch

1. In 3D, start dragging a device rect.
2. Mid-drag, press Tab to switch to 2D.

- [ ] 2.12.1 The cursor does not stay stuck in a drag/grab state after
      the switch.

### 2.13 3D→2D handoff after resize

1. In 3D, resize the browser window.
2. Press Tab to switch to 2D.

- [ ] 2.13.1 The head-on pose lines up with the 2D framing — no visible
      jump at the handoff (window-size subscription in scene-view
      should keep the pose current through the resize).

### 2.14 Playback scrubbing does not stutter the report

Preconditions: a video item active, Perception Report open.

1. Scrub the playhead back and forth continuously for several seconds.

- [ ] 2.14.1 The Perception Report does not visibly stutter or lag
      behind the scrub (text entries/verdicts are memoized off content,
      not recomputed per tick).

### 2.15 Regressions worth a glance

- [ ] 2.15.1 [[arc-minute-spreadsheet]] pinned rows: Switch Lite 22px
      ≈ 20′, Switch 22px ≈ 23′, 24″ 1080p 17px ≈ 23′.
- [ ] 2.15.2 Arrow-key device focus (↑/↓ cycling, ←/→ media) still
      works per v7 section 4.
- [ ] 2.15.3 Auto-OCR on import still fires per v7 section 5.
- [ ] 2.15.4 The calibration card still drags/resizes/keyboard-resizes
      normally, on top of the new cancel path.

### 2.16 3D camera: zoom to cursor, Ctrl+drag orbits the click

Landed after the fixes above (`96ab4e0`, reworked in `22d95b1`):
wheel zoom homes in on the point under the cursor; a plain left-drag
is drei's orbit as before; **Ctrl+left-drag** orbits around the 3D
point under the initial click, with a ring-and-dot marker at the pivot
for the duration of the drag. On the furniture and the figure the
pivot snaps to the model's bottom-centre rather than the clicked spot.

Preconditions: 3D view, starter devices, camera settled at the orbit
pose (fly-in finished).

1. Wheel over the far projector. **Expect:** the view converges on the
   projector, not the screen centre. [ ]
2. Wheel over empty sky. **Expect:** still zooms toward where the
   cursor is; no jump. [ ]
3. Plain left-drag anywhere. **Expect:** the same orbit as before this
   round; no marker. [ ]
4. Ctrl+left-drag starting on the Steam Deck's face. **Expect:** the
   marker appears at the click point and stays fixed on screen while
   the world turns around it; the marker keeps one screen size; it
   vanishes on release; no jump at press or release. [ ]
5. Ctrl+left-drag starting on a couch cushion (couch stance).
   **Expect:** the marker sits at the couch's base, centred under it,
   not on the cushion; the couch turns in place. [ ]
6. Ctrl+left-drag starting on the figure's arm. **Expect:** marker at
   the feet; the figure turns in place. [ ]
7. Ctrl+left-drag on the floor near the bottom of the window, drag
   upward hard. **Expect:** the camera stops at the horizon rather than
   flipping, and nothing snaps on release. [ ]
8. Ctrl+left-drag on empty sky. **Expect:** orbits around a point at
   the old target's depth. [ ]
9. Ctrl+press and release without moving. **Expect:** no camera change;
   the view does not pan (OrbitControls treats Ctrl+left as pan, and
   must not get it). [ ]
10. Left-drag on a device's distance handle, with and without Ctrl.
    **Expect:** the handle drags the device; the camera does not
    orbit. [ ]
11. Right-drag. **Expect:** pan unchanged. [ ]
12. Ctrl-orbit, then Tab to 2D. **Expect:** the exit fly aims correctly
    and the head-on pose lines up with 2D. [ ]
13. Orbit and zoom somewhere odd, then double-click the ground.
    **Expect:** the camera flies back to the default orbit pose (same
    tween as the 2D→3D entry); controls work again once it lands. [ ]
14. Double-click a device rect, the couch, and the figure. **Expect:**
    nothing happens to the camera. [ ]
15. `?` cheat sheet. **Expect:** the Double-click row mentions the 3D
    reset. [ ]

## 3. Also new on dev, no QA needed but be aware

- CI now gates `dev` the same way deploy gates `main` (`ci.yml`).
- `scripts/check-version.mjs` fails CI once a `v<version>` tag exists
  elsewhere; `package.json` is now `0.8.0`.
- Bun pinned at `packageManager: bun@1.4.0`.
- PRD rewritten to describe the shipped product (issue #13, awaiting
  review).
- Keyboard-accessibility gaps (2D selection, measure boxes, panel
  move/resize) filed as issue #12.

## 4. Decisions waiting on you

1. **Promotion to main.** `dev` carries v7's unreleased work (fit
   modes, offsets/tilt, grip work, calibration, arrow nav, auto-OCR)
   plus all of this plan's fixes — v7 was never QA'd, so promotion
   means signing off on both plans at once, or splitting the release.
2. **Push dev now?** dev is well ahead of `origin/dev`; pushing is
   what puts the new CI workflow to its first real run. Nothing here
   blocks on it, but the CI gate stays unverified in practice until it
   does.
3. **PRD review** (issue #13) — the rewrite replaced the April 2025
   sketch; worth a read before it's treated as source of truth again.
