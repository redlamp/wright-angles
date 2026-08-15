---
tags: [domain/product, status/open]
---

# Report 2026-08-15 — Overnight V2 Sprint

For Taylor's morning. Test steps: [[test-plan-2026-08-15-v2-sprint]].
The plan this executed: [[plan-2026-08-15-pro-polish]].

## Everything from your list, status

| Ask | Status |
|---|---|
| Device Manager slider widths + steppers | ✅ fixed grid + −/+ steppers everywhere |
| Onboarding for This Device | ✅ 3-step wizard, re-runnable |
| shadcn visuals on color-taylor tokens | ✅ rebuilt panels on shadcn idioms |
| 3D standing/sitting people, size + distance | ✅ scenarios (standing/desk/couch) + height |
| Smooth 2D↔3D camera change | ✅ head-on ⇄ orbit fly-through |
| Reference game images, local + gitignored | ✅ 16 shots, 8 games + Load samples |
| Media library "less low budget" | ✅ grid/list, sort, rename, detail, confirm |
| Generic image + device-color fills | ✅ 4 generated test images + fill toggle |
| Save/import/export devices, bigger settings | ✅ versioned JSON + expanded panel |
| "Seems X larger/smaller" report | ✅ Perception Report panel |
| Handheld 3D models (body vs screen) | ✅* chassis data + render pass landed after the 2:40am cutoff — verify |
| Accessibility + market research | ✅* re-run this morning after cutoff |
| Scene light/dark + system UI theme | ✅ system/manual UI theme, scene follow/override |
| Export images/samples as reference | ✅ PNG view export |
| Curved screens (your G9!) | ✅ 1000R adds ~6° width at 70cm — real, tested |
| 3D shows 2D content, video support | ✅* video pipeline done; 3D textures in the morning pass — verify |
| Pose tween + hands, framerate | ✅* same morning pass — verify |
| Highlight boxes with legibility flags | ✅ measure mode + per-device verdicts (2D; 3D mirror pending) |

\* = finished by the resumed agents after the session-limit interruption
(2:40am); typechecked and linted, but get your eyes on the 3D items.

## What I'd push on next (prioritized, not built)

1. **Browser-zoom warning** — non-100% zoom silently breaks 1:1; cheap
   to detect, high trust payoff.
2. **3D mirror of measure boxes** — bake boxes into the content texture.
3. **Credit-card calibration** — verify true PPI against OS scaling lies.
4. **Comparison table view** — the live spreadsheet (all devices ×
   H°/V°/PPD/′-per-px), exportable CSV.
5. **Per-device image assignment** + hot-zone image switching (PRD).
6. **Shareable setup links** (URL hash) — pairs with export/import.
7. **Non-linear distance slider** above ~150cm.
8. **EXIF strip on import** — studio privacy hygiene.
9. Cap-height vs body-height toggle for verdicts (research flagged the
   unit mismatch between ISO and platform px minimums).

## Notes

- Your localStorage was reset for a clean first-run (my automation had
  polluted it); the media library keeps the test card + one demo
  measured box showing the feature.
- The interrupted agents cost ~3 idle hours (2:40–5:52); everything else
  ran overnight as planned.
- Still holding: license decision, dev → main promotion.
