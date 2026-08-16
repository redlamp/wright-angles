---
tags:
  - domain/3d-scene
  - status/superseded
  - origin/taylor
---

# Prototype: Figure Rig Replacement

Taylor rejected the hand-built Asaro head (reverted, `7de1022`) and asked
for public-domain low-poly human models instead. This prototype evaluates
the leading candidate **before** any retarget work lands in the app.

## Where

- Route: `/prototype/figure` (dev only, not linked from the app).
- Code: `components/prototype/figure-compare.tsx` + `app/prototype/figure/page.tsx`.
- Assets: `public/prototype/ubc/` — **gitignored**, ~15 MB.

## The candidate

Quaternius **Universal Base Characters** (Superhero Male body), CC0 1.0 —
the shipped `License_Standard.txt` sits next to the model. The free
"Standard" tier only includes the Superhero body; Regular/Teen
proportions are in the paid Pro tier. ~13k tris, 65 bones, UE-style
skeleton (`pelvis`/`spine_01..03`/`clavicle`/`upperarm`/`lowerarm`/
`hand` + full fingers/`thigh`/`calf`/`foot`).

Rejected alternatives: Kenney Blocky Characters (CC0 but Minecraft-tone),
Poly Pizza / OpenGameArt rigged humans (mostly CC-BY), Mixamo (free to
use but not redistributable — can't live in a public repo).

## Restoring the assets on a fresh clone

itch.io fronts the download (no stable direct URL): quaternius.itch.io/
universal-base-characters → Download → unzip `Base Characters/Godot - UE/`
`Superhero_Male_*` + `T_Superhero_Male_*` + `T_Eye_*` into
`public/prototype/ubc/`. Three referenced textures carry `_png` suffixes
in the glTF: copy `T_Hair_1_Normal.png` → `T_Hair_1_Normal_png.png`,
`T_Eye_Normal.png` → `T_Eye_Normal_png.png`, plus `T_Hair_1_BaseColor.png`.

## What the prototype answers

1. **Style** — clay / flat-shaded clay / textured modes. Flat clay reads
   as planar low-poly, much closer to the Asaro intent than the
   hand-built head ever got.
2. **Rig drivability** — stances are rough world-space bone aims (twist
   discarded), NOT the final IK. All three stances pose correctly, which
   proves the retarget path: our existing pose/IK math can drive these
   bones.
3. **Eye-height contract** — overlay reports model eyes vs
   `eyeHeightCm()`: standing Δ 0.5 cm (excellent, unadjusted); seated
   Δ 3.3 cm with the pelvis-drop heuristic. A real retarget would pin
   the eye line directly instead of the pelvis, making Δ ≈ 0 by
   construction.

## Gotchas hit while building it

- A non-memoized measurement callback fed a `useEffect` →
  `setState(new object)` → render → new-callback loop that pegged the
  main thread and wedged the tab. Fix: `useCallback` + value-equality
  bail inside the setter. React-compiler did NOT stabilize the inline
  closure across the R3F boundary — don't rely on it there.
- `SkeletonHelper` pins its matrix to the rig root's `matrixWorld`;
  parenting it inside a scaled group double-transforms it. Add it to the
  scene root.
- Rig rest pose is a T-pose; "standing" aims the arms down so the
  comparison with the mannequin is fair.

## Decision (Taylor, 2026-08-15 late)

**Rejected** — "not wild about this model, seems very cartoonish. I'd
rather have something that's more accurate and generic." Kept the
procedural mannequin and gave it a lit `MeshStandardMaterial` (smooth
shading, roughness 0.9) with a figure-only hemisphere + key light rig in
scene-view, so the part forms read without changing the silhouette.
Prototype route, component, and local assets deleted the same night.

If a model swap ever comes back: the findings above still hold (CC0
sourcing, UE-rig drivability, eye-line pinning), but the body would need
neutral proportions — the free Quaternius tier only has the muscular
Superhero build.
