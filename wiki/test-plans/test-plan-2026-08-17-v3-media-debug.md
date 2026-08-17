# Test Plan v3.1 — Numbered Backlog (2026-08-17)

Every topic and item is numbered for call-outs ("do 6.3", "skip 10").
v0.3.0 was accepted by Taylor except the items reopened below.
**v0.3.1 hotfix shipped** the same morning: production crashed for
every fresh visitor (unstable zustand selector fallback → React #185
loop; all dev machines had stored state and sailed past it).

## 1. Fit & finish (reopened from acceptance)

- [x] 1.1 Fresh-visitor crash on the live site — fixed in v0.3.1;
      fresh-state smoke test added to the promotion gates (see 12.2).
- [ ] 1.2 Comparison table: column widths must not shift when the sort
      arrow moves — reserve the arrow's space.
- [ ] 1.3 Comparison table: clicking a row selects that device in the
      2D and 3D views (shared selection store).
- [ ] 1.4 Comparison table: font sizes up to the new type scale (topic 2).
- [ ] 1.5 Crop: the active preset is visibly highlighted; "Adjust"
      renamed "Custom".
- [ ] 1.6 Gamepad pose: hold is too high — lower it; forearms roughly
      10° tilted up from horizontal.
- [ ] 1.7 Standing desk: top sits just below the figure's elbow.
- [ ] 1.8 3D labels render in Barlow (vendored for troika), not the
      generic drei default.
- [ ] 1.9 Console hygiene: THREE.Clock deprecation is R3F-internal
      (upstream, no action); GPOS/GSUB font-table warnings come from
      troika's font parser — revisit after 1.8; rAF-violation and HMR
      lines are dev-only. Documented, not fixable app-side today.

## 2. Design system — type scale (Taylor: current text "would fail
   the legibility test")

- [ ] 2.1 Scale agreed in principle (Taylor 2026-08-17): work INSIDE
      shadcn + Tailwind conventions to show design-system craft —
      Tailwind type tokens only (`text-sm` 14px base, `text-xs` 12px
      floor, `text-base`/`font-medium` titles), kill every arbitrary
      `text-[10px]`/`text-[11px]`. Barlow throughout, Share Tech Mono
      readouts. See [[qa-2026-08-17-media-debug-decisions]].
- [ ] 2.2 Roll out across worst offenders first: comparison table,
      media library, scene HUD, panel chrome, onboarding.

## 3. Device side panel (click-to-inspect)

- [ ] 3.1 Clicking a device in 2D or 3D opens a control panel to the
      side: device details + hide/show toggle.
- [ ] 3.2 Panel has a header and is movable; idles at 40% alpha, full
      opacity on hover, quick tween between states.
- [ ] 3.3 Selection is shared app-wide (same store as 1.3).
- [ ] 3.4 Later: Stage-4 debug overlay toggles (topic 10) live here.

## 4. Hotkeys

- [ ] 4.1 m media · d devices · p perception · c comparison ·
      s settings · Tab 2D/3D toggle (suppressed while typing in
      inputs).
- [ ] 4.2 Confirmed additions (Taylor 2026-08-17): o OCR overlay ·
      x crop · 1/2/3 stances · q/w/e input types · ? cheat-sheet
      overlay (needs building — doesn't exist yet) · Esc deselect.
- [ ] 4.3 2D interaction change: drop Space-to-pan. Left mouse
      selects on click; dragging pans by default (drag threshold
      distinguishes the two).

## 5. Active media panel redesign (Taylor spec)

- [ ] 5.1 Row 1: media name, right-aligned red trashcan button =
      remove from library.
- [ ] 5.2 Details as consistent grid cells on one line: display size +
      source size; drop the unclear "shown as".
- [ ] 5.3 The media itself, then timeline.
- [ ] 5.4 Crop: active option highlighted; "Custom" (né Adjust) puts
      the crop handles OVER the existing media view — no second
      instance of the content.
- [ ] 5.5 Text detection: visible progress confirmation while
      scanning; when done, basic stats + buttons through to the
      comparison and perception panels.
- [ ] 5.6 Reference size gets a "?" hover tooltip explaining its use.

## 6. Perception report v2 — Miller columns

- [ ] 6.1 Window resizable, wider by default.
- [ ] 6.2 Lists ALL project devices, including ones hidden from
      2D/3D. BUG: distances render in inches when the unit setting
      says cm — must follow the setting.
- [ ] 6.3 Miller columns: "All devices" selected by default, "My
      Display" listed; selecting a device narrows column 2 to that
      device's report.
- [ ] 6.4 Measured boxes labeled with their OCR text when readable
      ("HEALTH 47/100"), falling back to "Box 1".
- [ ] 6.5 This Device is blessed (foundation of the vision model);
      a selected device's details render NEXT TO This Device's for
      comparison.

## 7. OCR quality — descenders + text grouping

- [ ] 7.1 Group nearby detected lines (infer word wrap and line
      spacing) and assume one font size per group.
- [ ] 7.2 Descender-aware sizing: a line without descenders currently
      measures only its visible ink and under-reports the font size;
      use the group's tallest metrics (and cap-height inference) so
      all lines in a group agree.
- [ ] 7.3 Visual indicator for groups in the overlay/inspector
      (shared outline tint or group badge).
- [ ] 7.4 Test steps: scan a screenshot containing a paragraph plus a
      short all-cap line; before = the cap line reports smaller px;
      after = both report the group size, and the group indicator
      wraps both.

## 8. OCR → perception report (approved; ties into 7's groups)

- [ ] 8.1 Scan results (grouped) feed the report's measured-box list.
- [ ] 8.2 How to test: load a UI screenshot → Text detection → open
      Perception Report → the boxes appear with their text labels and
      per-device arcmin verdicts; smallest text in shot is called out.

## 9. Video OCR keyframes (Taylor: user-set, batch or piecemeal)

- [ ] 9.1 User sets OCR keyframes on the timeline; scans run per
      keyframe (batch queue or one-at-a-time).
- [ ] 9.2 Markers drawn on the timeline; `<` / `>` jump to
      previous/next marker and pause; Space toggles play/pause.
- [ ] 9.3 A keyframe's scan stays displayed until the playhead passes
      the next marker.

## 10. Beyond-text debug overlays (later; toggles live in the device
    panel, 3.4)

- [ ] 10.1 Contrast probe (text vs background → WCAG flags).
- [ ] 10.2 Pixel loupe with px + arcmin ruler.
- [ ] 10.3 TV safe-area overlays.
- [ ] 10.4 Sub-acuity detail warning (<1′ strokes).
- [ ] 10.5 Color-vision simulation.

## 11. Backlog (triaged by Taylor 2026-08-17)

- [ ] 11.1 Browser-zoom ≠ 100% warning. (approved)
- [ ] 11.2 Credit-card calibration. (approved)
- [ ] 11.3 Measure boxes mirrored into the 3D texture. (approved)
- [ ] 11.4 Per-device media assignment — awaiting Taylor's read on the
      spec (explained in chat 2026-08-17): each device can hold its
      own image; hot zones in the 2D overlay switch which device's
      content is active under the cursor.
- [ ] 11.5 EXIF strip on import; non-linear distance slider.
- [ ] 11.6 Shareable setup links — DEFERRED (implies shared data).
- [ ] 11.7 Licensing — breakout session, scheduled separately.

## 12. Process

- [x] 12.1 Feature branches (`feature/*`, `fix/*` → dev, `--no-ff`) —
      in effect as of the v0.3.1 hotfix.
- [ ] 12.2 Promotion gate addition: fresh-state smoke test — clear
      site storage, load, confirm boot — before every dev → main.
      This is the class of bug that took down v0.3.0.
