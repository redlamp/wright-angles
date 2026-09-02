---
tags: [domain/product, status/superseded]
---

# Test Plan v6 — Device Fit + Label Pass (2026-08-20)

**Superseded by [[test-plan-2026-08-21-first-run]]** — its section 8
backlog carried forward whole, minus what shipped.

Supersedes [[test-plan-2026-08-19-morning-review]] and
[[test-plan-2026-08-19-per-device-crop]] (that one's sections 2–4 are
void — you rejected the approach it tested). Everything below is on
`dev`; main is at v0.7.0.

## 1. What happened today

- **v0.7.0 → main** on your go-ahead: per-device crops + the
  projection-ray head clearance. Pages deploy green.
- **Then you rejected per-device crops on review** — Media Library
  cropping fixes the *source*; how content meets a mismatched screen is
  a *device* concern. Re-framed as device-owned fit modes
  ([[decision-media-crop-vs-device-fit]]), built, merged to dev.
- 3D device-name labels reworked (placement, size, de-collision).
- Comparison Table stopped scrolling sideways.
- Two decisions recorded and not yet built:
  [[decision-viewing-geometry-tilt-and-falloff]] and
  [[plan-content-adaptation-nine-slice]].

## 2. Device fit modes — the main course

Device Manager → expand a device → **Fit** (under Curve). Best tested
with a 16:9 capture on the 32:9 Super Ultrawide.

- [ ] 2.1 Default is "Scale to fit" on every device, and untouched
      devices look exactly as they did before today.
- [ ] 2.2 "Fill width (crop top/bottom)" on the ultrawide: content
      spans the full panel width, top and bottom trimmed equally, no
      bars. Other devices unaffected.
- [ ] 2.3 "Fill height (crop sides)": content spans the full height,
      sides trimmed equally.
- [ ] 2.4 A fill mode that would need to ADD content instead trims
      nothing and letterboxes on the other axis (never stretches or
      extrapolates).
- [ ] 2.5 2D and 3D agree — same framing, same trimmed edges, for every
      mode on the same device.
- [ ] 2.6 Measure boxes land on the same content in both views, and a
      box trimmed out of a device's frame shows the muted "not on this
      screen" chip in the Perception Report instead of a verdict.
- [ ] 2.7 Export view PNG draws each rect through its own fit.
- [ ] 2.8 Video/GIF obey per-device fit and stay in lockstep.
- [ ] 2.9 Hover a device → the quick Fit dropdown appears above "Edit in
      Device Manager", and ONLY when that device's shape and the media's
      shape actually disagree. (Known: with no media loaded it never
      appears, since nothing can disagree.)

## 3. Stretch to fit (your call, landing separately)

- [ ] 3.1 "Stretch to fit" scales width and height independently:
      content touches all four edges, nothing cropped, no bars, image
      visibly distorted.
- [ ] 3.2 Measure boxes still land correctly under stretch — this is
      the risky one. Overlays are placed by the same fit geometry that
      draws the content, so if they drift, that coupling broke.
- [ ] 3.3 The reported arc minutes are the VERTICAL figure, and a badge
      names the distortion ("stretched 1.8× wide · arcmin is vertical").
      Rationale in [[decision-media-crop-vs-device-fit]]'s amendment.
- [ ] 3.4 2D and 3D agree under stretch too.

## 4. Media Library crop is source-only again

- [ ] 4.1 The crop row has NO device scope: no "applies to" control, no
      "N per-device" chip, no inherit/device-aspect entries. It edits
      one crop for the item, exactly as before v0.7.0.
- [ ] 4.2 A source crop still applies everywhere, and the device fit
      reframes what's left of it (the two compose, source first).

## 5. 3D name labels

- [ ] 5.1 Every device name is the same size regardless of panel size.
- [ ] 5.2 Clustered names stack vertically, centred over their own
      screens — nothing flung sideways. (Was: offset by half the
      panel's width, so a 32:9 threw its label ~60cm out.)
- [ ] 5.3 Names sit close to the screen they name; a label only rises
      far enough to clear the one beneath it.
- [ ] 5.4 The ladder holds through a full orbit — no swapping,
      collapsing, or colliding at any camera angle.
- [ ] 5.5 Long names don't overlap their neighbours (de-collision now
      measures name *width*, not font size).

## 6. Comparison Table

- [ ] 6.1 No horizontal scrollbar at the default panel width.
- [ ] 6.2 Still none at max width, and none after switching size to cm
      and distance to imperial (the widest formats — this is what the
      raised 720px cap is for).

## 7. Regressions worth a glance

- [ ] 7.1 The three pinned arc-minute rows still read true against
      [[arc-minute-spreadsheet]] (Switch Lite 20′, Switch 23′, 24″
      1080p 23′). Automated and green, but worth one human look.
- [ ] 7.2 Nothing references per-device crops anywhere in the UI.
- [ ] 7.3 Your existing media and devices survived untouched. (Checked:
      none of your 5 items carried a v0.7.0 `deviceCrops` key, so there
      was nothing to migrate.)

## 8. Standing backlog — carried from v5, still yours to call

- [ ] 8.1 **[[decision-viewing-geometry-tilt-and-falloff]] is adopted
      but unbuilt** — per-stance tilt + auto-orient, all three stance
      heights editable at once, and the distance-falloff probe/overlay.
      This is the biggest ready-to-build item; say go and it's next.
- [ ] 8.2 Issue #2 needs your ranking: is auto-OCR next, and which
      timeline option (A manual only / B scan t=0 / C scene-change
      proposals)?
- [ ] 8.3 (11.4) Per-device media assignment — spec still awaits your
      read. Now that crop scope is gone, the Device Manager is the
      natural home.
- [ ] 8.4 Issue #1: the three parked flags (3D bodies, pinned devices,
      column collapse).
- [ ] 8.5 Sub-retina (<60 PPD) indicator — flagged in the Comparison
      Table already; approve, park, or kill it for the main views.
- [ ] 8.6 Licensing follow-up: code is MIT (LICENSE in root). Confirm
      whether anything beyond the code license was meant, or close it.
- [ ] 8.7 Shareable setup links — deferred unless you say otherwise.

## 9. Process notes

- dev is ahead of main by the fit-mode work, the label pass, the table
  fix, and the wiki. Promotion on your word: gates + production export
  + fresh-origin smoke on 7842, as always.
- Two process rules landed in the root `CLAUDE.md` after they bit us:
  agent worktrees are cut from `origin/HEAD` (= main) and must rebase
  onto dev first, and refactors run in a worktree so your dev server
  never serves a half-finished tree.
