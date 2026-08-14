---
tags: [domain/product, origin/prior-art, status/verified]
---

# Prior Wright Angles Attempts

Four earlier attempts live in `C:\workspace\`; none shipped the core
feature. Surveyed 2026-08-14. Taylor's note: newer projects reflect his
taste better, but these are all early — treat as parts bins, not blueprints.

| Project | Stack | Got to |
|---|---|---|
| `wright-angles-OLD` (Apr 2025) | Vue 3 + Vuetify | Only one with real math: visual-angle readout in arcmin. No visualization. |
| `WrightAnglesCopilot` (Apr 2025) | Nuxt 3 | Device card grid, one commit, math wrong (all cards same height). |
| `Wright-Angles-old-2` (Jun 2025) | Nuxt 3 | Best UI shell: draggable Device Manager, auto-hiding sidebar. Zero math. |
| `wright-angles-godot` (Jun 2025) | Godot 4.4 | Sketch only; device dictionary + signals, nothing drawn, code has parse errors. |

## Worth keeping (and kept)

- Preset list with real handheld panel specs (OLD) → `lib/presets.ts`.
- Collapsed device row that still exposes the distance slider (both Vue
  attempts + Figma mock).
- Per-device eye toggle and key color; "This Device" vs "Test Devices"
  split.
- Draggable floating panels over a full-bleed display area.

## Mistakes this build must not repeat

- **Diagonal-as-chord math**: OLD computed the diagonal's subtense and
  ignored aspect ratio entirely; width/height must be derived separately.
- **No PPD/arcmin-per-pixel anywhere** — the angular-resolution half was
  never written.
- **Unit soup**: size in inches and distance in cm mixed in one form with
  a single toggle. Canonical units now: diagonal-in, distance-cm, with
  display conversion at the UI edge.
- **The comparison view was never built in any attempt.** It's the whole
  product; it ships first, not last.
