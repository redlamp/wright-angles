# Test Plan v3.1 — Numbered Backlog (2026-08-17)

Every topic and item is numbered for call-outs ("do 6.3", "skip 10").
v0.3.0 was accepted by Taylor except the items reopened below.
**v0.3.1 hotfix shipped** the same morning: production crashed for
every fresh visitor (unstable zustand selector fallback → React #185
loop; all dev machines had stored state and sailed past it).

## 1. Fit & finish (reopened from acceptance)

- [x] 1.1 Fresh-visitor crash on the live site — fixed in v0.3.1;
      fresh-state smoke test added to the promotion gates (see 12.2).
- [x] 1.2 Comparison table: column widths must not shift when the sort
      arrow moves — reserve the arrow's space.
- [x] 1.3 Comparison table: clicking a row selects that device in the
      2D and 3D views (shared selection store).
- [x] 1.4 Comparison table: font sizes up to the new type scale (topic 2).
- [x] 1.5 Crop: active state highlighted; "Custom" rename — shipped,
      then superseded same morning by the 5.4 aspect redesign.
- [x] 1.6 Gamepad pose: hold is too high — lower it; forearms roughly
      10° tilted up from horizontal.
- [x] 1.7 Standing desk: top sits just below the figure's elbow.
- [x] 1.8 3D labels render in Barlow (vendored for troika), not the
      generic drei default.
- [ ] 1.9 Console hygiene: THREE.Clock deprecation is R3F-internal
      (upstream, no action); GPOS/GSUB font-table warnings come from
      troika's font parser — revisit after 1.8; rAF-violation and HMR
      lines are dev-only. Documented, not fixable app-side today.

## 2. Design system — type scale (Taylor: current text "would fail
   the legibility test")

- [x] 2.1 Scale agreed in principle (Taylor 2026-08-17): work INSIDE
      shadcn + Tailwind conventions to show design-system craft —
      Tailwind type tokens only (`text-sm` 14px base, `text-xs` 12px
      floor, `text-base`/`font-medium` titles), kill every arbitrary
      `text-[10px]`/`text-[11px]`. Barlow throughout, Share Tech Mono
      readouts. See [[qa-2026-08-17-media-debug-decisions]].
- [x] 2.2 Roll out across worst offenders first: comparison table,
      media library, scene HUD, panel chrome, onboarding.

## 3. Device side panel (click-to-inspect)

- [ ] 3.1 BUILT, verify: clicking a device in 2D or 3D opens the
      inspector card — details + hide/show eye + Device Manager link.
- [ ] 3.2 BUILT, verify: header + movable; idles at 40% alpha, full
      opacity on hover (150ms tween).
- [ ] 3.3 BUILT, verify: selection is shared app-wide (same store as
      1.3); Esc closes.
- [ ] 3.4 BUILT: Debug overlays section exists in the inspector;
      color-vision sim (10.5) is its first toggle.

## 4. Hotkeys

- [x] 4.1 BUILT, verify: m media · d devices · p perception ·
      c comparison · s settings · Tab 2D/3D toggle (suppressed while
      typing in inputs).
- [x] 4.2 BUILT except x/o (wire once crop v2 and the OCR overlay
      exist — listed "soon" in the sheet): 1/2/3 stances · q/w/e
      input types · ? cheat-sheet overlay · Esc deselect.
- [ ] 4.3 BUILT, verify: Space-pan dropped; left mouse selects on a
      stationary click, pans past a 4px drag threshold; double-click
      recenters; measure mode and buttons exempt.

## 5. Active media panel redesign (Taylor spec)

- [x] 5.1 BUILT, verify: name row at the TOP with the red trashcan
      icon (arms the two-step confirm; bottom remove link gone).
- [x] 5.2 BUILT, verify: DISPLAY / SOURCE grid cells above the media,
      identical layout for every item; shown-as removed.
- [x] 5.3 BUILT with 5.1–5.2: name → details → media → timeline order.
- [x] 5.4 BUILT, verify: crop v2 — one aspect row (None · 4:3 · 5:4 ·
      16:9 · 16:10 · 21:9 · 32:9 · Custom), overlay editor on the
      media, playhead pauses on crop interaction, native-aspect
      images highlight their ratio button.
- [ ] 5.5 BUILT, verify: scan status line (batch shows "Scanning k of
      n…"), post-scan links open the comparison table and perception
      report.
- [x] 5.6 BUILT, verify: reference size "?" tooltip.
- [ ] 5.7 BUILT, verify (Taylor's 10:43 batch): scan boxes over the
      media (no second image), eye toggle by the section header,
      Detect + Clear on the header line, resizable results list,
      local-only note centered IN the title bar, always two columns,
      independent column scrolling.

## 6. Perception report v2 — Miller columns

- [x] 6.1 Window resizable, wider by default.
- [x] 6.2 Lists ALL project devices, including ones hidden from
      2D/3D. BUG: distances render in inches when the unit setting
      says cm — must follow the setting.
- [x] 6.3 Miller columns: "All devices" selected by default, "My
      Display" listed; selecting a device narrows column 2 to that
      device's report.
- [ ] 6.4 BUILT, verify: OCR-sourced measure boxes carry their read
      text as a label; the report names boxes by it, else "Box 1".
- [ ] 6.5 This Device is blessed (foundation of the vision model);
      a selected device's details render NEXT TO This Device's for
      comparison.

## 7. OCR quality — descenders + text grouping

- [ ] 7.1 BUILT, verify: lib/text-groups clusters lines into blocks
      (gap, column alignment, height-ratio gates); 7 pinned tests.
- [ ] 7.2 BUILT, verify: group size = tallest member capped at 1.4×
      the member median; arcmin verdicts and shown px use it.
- [ ] 7.3 BUILT, verify: group tint dots in the list and matching
      outline colors on the media overlay.
- [ ] 7.4 Test steps: scan a screenshot containing a paragraph plus a
      short all-cap line; before = the cap line reports smaller px;
      after = both report the group size, and the group indicator
      wraps both.

## 8. OCR → perception report (approved; ties into 7's groups)

- [x] 8.1 Scan results (grouped) feed the report's measured-box list.
- [x] 8.2 How to test: load a UI screenshot → Text detection → open
      Perception Report → the boxes appear with their text labels and
      per-device arcmin verdicts; smallest text in shot is called out.

## 9. Video OCR keyframes (Taylor: user-set, batch or piecemeal)

- [x] 9.1 BUILT, verify: bookmark button places/removes keyframes at
      the playhead; Scan frame scans one, Scan all batches the
      unscanned in order (engine frame → local OCR).
- [x] 9.2 BUILT, verify: diamond markers under the timeline (filled =
      scanned) click-seek+pause; `<`/`>` (`,`/`.`) jump markers and
      pause; Space toggles play/pause.
- [x] 9.3 BUILT, verify: the active keyframe's boxes/list persist
      until the playhead passes the next marker; Clear keeps markers,
      drops scans. All 9.x built without a browser (extension was
      down) — gates green, needs the visual pass.

## 10. Beyond-text debug overlays (later; toggles live in the device
    panel, 3.4)

- [ ] 10.1 Contrast probe (text vs background → WCAG flags).
- [ ] 10.2 Pixel loupe with px + arcmin ruler.
- [ ] 10.3 TV safe-area overlays.
- [ ] 10.4 Sub-acuity detail warning (<1′ strokes).
- [ ] 10.5 Color-vision simulation — BUILT, verify: Machado 2009
      matrices (protan/deutan/tritan + 709 achromatopsia) as SVG
      linearRGB filters over the 2D/3D view layers only; control in
      the inspector's Debug overlays section; persisted.

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
