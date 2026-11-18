---
tags: [domain/3d-scene, status/draft, origin/taylor]
---

# Low-Poly Figure Sources

Research for replacing the capsule viewer figure with a simple rigged
human in the style Taylor pointed at: Denys Almaral's City People,
Studio Ochi's Lowpoly People, kanistra's Lowpoly People Colorful. What
those share: human proportions (7 to 7.5 heads tall), faceted flat-color
polyart, 1.2 to 1.6k triangles, one palette texture. Done 2026-10-16.
Supersedes the sourcing half of [[prototype-figure-rig]]; the rig
findings there still hold.

## The constraint that decides everything

The repo is public (github.com/redlamp/wright-angles) and GitHub Pages
serves `public/` as plain files, so any figure we ship is a standalone
download of the model file. Every marketplace license forbids exactly
that:

- Unity Asset Store EULA: other engines are fine, but assets may not be
  redistributed as standalone items or in a way that lets others extract
  them. A `.glb` in a public repo is both.
- Fab Standard License: any tool is fine, private repos are fine, but not
  redistributing "for free on a standalone basis".
- Sketchfab Store (Standard): bars making the material available "in a
  manner intended to allow or invite a third party to download".
- Mixamo: Adobe staff say no copying or redistribution of the original
  content on a website or similar platform.

So only CC0 or CC-BY assets can live in the repo. Store-licensed packs
can only be used locally, the way the Disco Elysium models will be for
the case-study presentation mode: a gitignored folder plus a loader.

## Taylor's links, checked

| Asset | License | Rigged | Verdict |
|---|---|---|---|
| Almaral, Low-Poly People Mega-Pack (Sketchfab, sold via Fab) | Store license | Yes, 3ds Max Biped | 123 characters, palette texture. Cannot ship; local use only. |
| Almaral, City People Mega-Pack (Unity) | Unity EULA, EUR 91 | Yes | Same. |
| Almaral, City People FREE Samples (Unity, Fab) | Unity EULA / Fab Standard | Yes | Free, same clause. Cannot ship. Good as a local style reference. |
| Studio Ochi, Freebie Lowpoly People | CC BY-NC-ND 4.0 | Not stated | ND forbids re-rigging and recoloring. Out. |
| Studio Ochi, Winter People Animated | Store license | Yes, 9 clips | Cannot ship. |
| kanistra, Lowpoly People Colorful | Store license | No, 167 static poses | Archviz figures. Out. |
| Almaral, 4000 Posed People; People Protesting | Store license | No, posed | Archviz crowds. Out. |

## Free packs tried and rejected

Every free rigged low-poly human we found is stylized with an oversized
head; none has Almaral's proportions.

| Asset | License | Notes | Outcome |
|---|---|---|---|
| David Jalbert, Low Poly People (itch) | CC BY 4.0 | 18 figures, man/woman x normal/strong/fat, 1.1 to 1.3k tris, 64 px palette, 21-joint rig, glTF | Wired into the audition picker: standing, desk and couch posed with no tuning, heights 1.73 to 2.08 m. **Rejected by Taylor 2026-10-16**: cartoon proportions, "we want something that looks more human sized". Removed. |
| Quaternius Man / Woman / Character, GDQuest Mannequiny, Rafael base, Khronos RiggedFigure | CC0 / CC-BY | The 2026-10-14 audition | Rejected 2026-10-15. |
| Quaternius Universal Base Characters, free tier | CC0 | Downloaded 2026-10-16 to check: the free Standard zip holds only Superhero_Male and Superhero_Female (glTF + FBX) plus hairstyles. Regular and Teen bodies are in the USD 20 Source tier. | Superhero body rejected 2026-08 as cartoonish. |
| KayKit Adventurers, Kenney Blocky / Mini | CC0 | Fantasy / blocky | Wrong style. |

Packs with human proportions that are CC0 but need Blender to even open:
pistachio's Human basemeshes on OpenGameArt (male and female, about
1,150 tris, rigged, UV-mapped, `.blend` only) and Clint Bellanger's Base
Human Models (CC-BY 3.0, 408 quads, `.blend`). Both are nude base
meshes; clothing would be color regions, not geometry.

## Routes that give human proportions

1. **Generate our own, CC0, USD 0.** MakeHuman (standalone 1.2, or the
   MPFB2 add-on inside Blender 4.2+) produces a parametric human body:
   height, sex, age, muscle, weight, proportion sliders, with a
   "game engine" skeleton. Official unmodified exports are CC0. Pipeline,
   all scriptable in Blender background mode: generate the body at a
   neutral build, Decimate to about 1.5 to 2k triangles (collapse keeps
   the skin weights), flat shading, export glTF. Clothes become color
   regions assigned per bone (head, neck, hands = skin; spine, upper
   arms = shirt or jacket; legs = trousers; feet = shoes), which is also
   how outfit swaps and the Harry / Kim palettes work, with no extra
   geometry. Needs Blender, not installed here: the portable zip is
   `blender-4.5.14-windows-x64.zip`, 399 MB from download.blender.org,
   no admin rights. MPFB2 latest is v2.0.18.
2. **Buy Quaternius Universal Base Characters Source, USD 20, CC0.**
   Regular male and female bodies at neutral proportions, about 13k tris,
   humanoid rig, `.blend` included. Decimate the same way (or gltfpack
   `-si`, which preserves skinning without Blender) and flat-shade.
   Faster to a first result; proportions are Quaternius's, not ours.
3. **Almaral's free samples, local only.** Exact target style, but only
   through a bring-your-own-figure loader on Taylor's machine (the same
   gitignored-folder loader the Disco Elysium presentation mode needs).
   Cannot be the shipped default.

Recommendation: route 1. It is the only one that is free, redistributable
and gives us control of proportions, and the per-bone color scheme makes
height, body type and outfits all data rather than assets. Route 3 can
sit alongside it as the local reference.

## Result: route 1 built and tested (2026-10-16, late)

Taylor chose route 1. Tooling lives outside the repo:

- Portable Blender 4.5.14 at `C:\workspace\tools\blender\blender-4.5.14-windows-x64\`
  (a `portable\` folder keeps its config there; no install).
- MPFB2 v2.0.18 installed into that Blender as an extension; the zip and the
  generator script are in `C:\workspace\tools\mpfb\`, the MPFB2 source
  clone (for API reference and `script_samples/`) in `C:\workspace\tools\mpfb2-src\`.
- `make_figure.py` runs headless: `blender.exe -b -P make_figure.py -- --out
  x.glb --gender 0..1 --height 0..1 --weight --muscle --proportions --tris N`.
  It creates the base mesh with those macros, adds the `game_engine` rig
  (53 bones, UE names: pelvis, spine_01..03, neck_01, head, clavicle_l,
  upperarm_l, lowerarm_l, hand_l, thigh_l, calf_l, foot_l), bakes the
  helper mask, bakes the shape keys (Decimate refuses to apply over shape
  keys), collapse-decimates with X symmetry to the target count, sets flat
  shading, and exports a GLB with skin, no textures.

Numbers at 1,600 triangles: neutral 1.654 m, male 1.726 m, female 1.586 m
(macro height 0.5; the app scales to the slider anyway). 1,000 and 2,400
variants exist for a facet-density comparison. Files sit untracked in
`public/figures/audition/mpfb/` with a CC0 `CREDITS.md`.

In the audition picker all three stances pose with no tuning and the eye
readout is +2.9 cm standing, +3.5 cm seated with the body anchor, so the
head-joint heuristic that was 10 to 15 cm off on stylized packs is nearly
right on a human-proportioned body. The figure is a nude gray mannequin:
clothes are the next step, as color regions assigned per bone (head, neck,
hands skin; spine and arms shirt; pelvis and legs trousers; feet shoes),
which also gives outfit swaps and the Harry / Kim palettes for free.

### Reference from Taylor (2026-10-16, late)

Almaral's Fab free listings, People Protesting Mockup Free Sample
(`fab.com/listings/248e057f-...`, 4 posed figures) and City People Free
Samples (`fab.com/listings/8fece26a-...`, 11 rigged, Unity Humanoid): the
spec he publishes is "2000 average triangles", one 256 px palette texture
where "regions on the texture image define parts of the model", no vertex
color, no modular parts. Both need an Epic sign-in to download, so they
stay a visual reference; neither can ship (Standard License).

Our pipeline now targets 2,000 triangles (neutral 1.659 m, male 1.726 m,
female 1.591 m at macro height 0.5) and does the palette regions as
per-face vertex colors instead of a texture: `figure-outfits.ts` maps a
bone name to a region (skin, hair, top, sleeve, bottom, shin, shoe), the
head splits into hair and skin at a hairline 4.5 percent of body height
above the eye estimate plus the back of the skull, and each triangle
takes the majority region of its corners so borders stay crisp. An outfit
is seven colors plus long/short sleeves and legs; five ship in the picker
(casual, office, summer, "Disco-ass blazer", "Orange flight jacket"). The
picker's Look select switches between the glTF material, scene gray and
outfit. The rejected packs are out of the picker; only the MPFB bodies
remain.

Known rough edges: the shirt-to-trousers border at the waist is a
triangle saw-tooth because it follows the spine_01 / pelvis weight split;
hands and feet are blobs at this density; no face, hair is a painted cap.

### Dressed figures (2026-10-16, latest)

Taylor called the per-bone painted regions poor, rightly: jagged waist,
no collar or cuffs, no shoe shape. The fix is modeled garments. The CC0
MakeHuman system asset pack (`makehuman_system_assets_cc0.zip`, 281 MB,
fast from `files.makehumancommunity.org`, unzipped into MPFB's user
`data/`) has 14 suits, 6 shoes, 10 hairstyles, 12 eyebrows, eyes, skins,
and hand-built low-poly proxy bodies (`male1591`, `female1605`, 1.6k
quads with designed topology; `proxy741`).

`make_figure.py` now takes `--asset subdir/file.mhclo` (repeatable) and
`--proxy male1591.proxy`. Each garment stays its own skinned mesh; all are
decimated to share the triangle budget (proxy bodies exempt), flat shaded,
and each mesh's texture is baked to a few flat colors per face with
area-weighted k-means, one material per color (`Clothes.0`, `Hair.1`,
...). The glTF therefore carries a handful of named flat materials the
app can tint later; the audition picker's "glTF material" look shows them.

Results: `dressed-male-2000` (decimated base body, casual suit, shoes,
short hair, eyes, brows: 2,070 tris) and `proxy-male-2000` (male1591
body under the same clothes: 3,077 tris). Both read as a person with
hair, a face and clothes, a clear step up from the painted regions, but
they still lag Almaral and Ochi: decimated garments have no edge flow,
the suit's three baked colors are near-identical blue-grays, hands are
blobs. The proxy body's better topology is mostly hidden under the suit.

Candid ceiling: a generated-and-reduced figure will not match hand-modeled
polyart. Ways to actually get that quality: buy Almaral's City People
Mega-Pack for local-only use through a bring-your-own-figure loader (on
sale at about GBP 27 until 2026-10-17 17:00 ET), or ask him for a
redistribution license on the 11 free samples for this open-source tool
(contact on his Unity listing), while the generated figure stays the
shippable default.

### Almaral's free samples, loaded locally (2026-10-16, night)

Taylor downloaded both Fab listings himself. The City People glTF pack
holds 11 rigged figures (Noesis export, centimeters, 1.5 to 2.5k tris,
30-bone 3ds Max Biped rig named `bip Pelvis`, `bip Spine`, `bip Neck`,
`bip Head`, `bip L Thigh` / `Calf` / `Foot`, `bip L UpperArm` /
`Forearm` / `Hand`), one 256 px `people_pal.png` plus 23 palette variants
in `TEXTURES/`, and 30 animation glTFs. The protest sample is a static
posed scene with sign textures.

They live in `public/figures/local/` (gitignored, with `LICENSE-NOTE.md`)
and reach the picker through `manifest.json` in that folder: the picker
fetches it on mount, missing is the normal case on a fresh clone, and
entries show under "Local only (not redistributable)". This is the
bring-your-own-figure loader in embryo; the Disco Elysium presentation
mode can use the same path.

Result: the Biped mapping drives every stance with no changes to the rig
code, eye readout +4.5 cm with the body anchor, palette texture intact
under the "glTF material" look. Palette swapping (the `people_pal_s*.png`
variants) is a texture swap and is not wired yet.

### Rig driver rework (2026-10-17, early)

Taylor: the Almaral models are the look, the rigging was not. The driver
was rebuilt around them and split into sibling modules:

- `rig-math.ts`: bone lookup, world-space aim, pitch, and `rollToward`
  (twist a bone about an axis so one direction swings toward another).
- `figure-hands.ts` (pure numbers): per stance and input, where each hand
  goes and how it sits. Asymmetric at the keyboard (left on WASD, right
  out on a mouse 2 cm above the surface), a controller held in the lap
  with elbows tucked, a handheld gripped by its edges. Each plan carries
  a finger direction and a palm direction. Also the posture table:
  pelvis tips back when seated, spine leans in at a desk (12 deg) and
  reclines on the couch, head counters to keep the gaze level and pitches
  down to a handheld.
- `figure-regions.ts`: the outfit color regions and the head-span measure.
- `rigged-figure.tsx`: measures each model itself at build time, which is
  what makes one driver fit every Almaral body: eye line at 55 percent of
  the head bone's own vertex span (chin to crown), finger and thumb bones
  found by name or by geometry, palm normal from fingers x thumb, foot
  rest orientation kept so feet stay flat, seat drop from the thigh
  vertices. `tuning` on a manifest entry overrides eye fraction, palm
  direction or arm reach per model when the measure is wrong.
- `rig-overlay.tsx`: "Show rig" draws the skeleton and yellow dots on the
  wrist targets. The helper sits beside the figure, not inside the scaled
  group.

`candidates.ts` names the canonical roles in Mixamo's bone names
(`MIXAMO_ROLES`, `mixamoSide`): a Mixamo auto-rigged export maps with no
manifest work, and Mixamo clips bind by those names. Almaral's Biped and
MPFB's game_engine rigs map onto the same roles.

Verified on the casual man: desk with mouse and keyboard, couch with a
controller, standing with a handheld, eye readout within 1 to 6 cm with
the body anchor.

Taylor's first pass on the result: hands too big, shoulders high and
hunched in, elbows sucked into the torso. Causes and fixes: the Biped
rest pose shrugs and nothing lowered the clavicles once the arms came
down (the driver now finds the clavicle above each upper arm and tips it
down 8 to 9 degrees when the hands are below the shoulders, 2 when
raised); the elbow hint pointed mostly down so elbows hugged the ribs
(poles now carry a strong outward component per input); the finger aim
pointed level along the desk so the wrist cocked up and the palm showed
broadside, which reads as a bigger hand (fingers now continue the
forearm's slope down to the keys, palm roll capped at 60 degrees).

## What the audition rig already proves

The `feature-figure-audition` worktree has a dev-only picker that swaps
the capsule figure for a rigged glTF and drives it from the same pose
numbers (two-bone IK in `lib/limb-ik.ts`, bone aiming in
`components/view3d/figure-audition/rigged-figure.tsx`). Any humanoid
with hips, head, and upper/lower limb joints poses standing, at a desk
and on a couch with no per-model work; the "eyes" anchor pins the sight
line to `eyeHeightCm()`. So the open question is purely the body, not
the driver.

## Furniture (desk, chair, couch, keyboard, mouse)

| Pack | License | Formats | Notes |
|---|---|---|---|
| **Kenney, Furniture Kit 2.0** (kenney.nl/assets/furniture-kit) | CC0 | GLB, glTF, FBX, OBJ, DAE | **Adopted 2026-10-17.** Realistic proportions, flat shading, 140 pieces incl. desk, deskCorner, chairDesk (office chair), loungeSofa / loungeSofaLong, computerKeyboard, computerMouse, computerScreen. Units about half a meter: desk top at 0.384, sofa seat at 0.23. |
| KayKit, Furniture Bits (kaylousberg.itch.io/furniture-bits) | CC0 | OBJ, FBX, glTF | Tried first, 2026-10-17. Chunky kid-set proportions (1.22 m tall couch, 1 m table); Taylor: "no models from kids sets". Removed. |
| mastjie, Low poly household goods (itch) | CC0 | FBX, glTF | Desk, chair, 2-seat sofa, TV, computer, coffee table. Not tried. |

In the scene (`components/view3d/furniture-models.tsx`, used by
`scenario-props.tsx`): each Kenney GLB is cloned per use, its materials
recolored to the scene palette (cushions "carpet" to the soft neutral,
wood and metal to furniture) so props keep reading as context behind
the device key colors, and the existing rise-and-fade crossfade now
fades every material under a furniture group. Desk scaled 193 (top at
74 cm, 141 wide, depth squeezed to 70), chair 190, sofa 174 (seat at
40 cm), keyboard and mouse 130 (37 cm keyboard, 11 cm mouse) at the
rigged figure's hand targets. The standing desk is still the box.

The controller the figure holds is built in code
(`figure-audition/controller-prop.tsx`): rounded body, angled grips,
sticks, d-pad, face buttons, bumpers and triggers; it scales in and out
with the stance tween. No CC0 low-poly controller model turned up.

Nothing here is committed or pushed.
