# Wright Angles — Product Requirements

**Author:** Taylor Wright · **Origin:** Google Doc "Wright Angles Design
Doc" (Attempt 2, April 2025), updated for the 2026 web build. Source
pointers in `wiki/research/source-material-miro-figma.md`.

## 1. Purpose

Wright Angles uses arc minutes to show accurate display sizes across
device types (handheld, desktop, living room) and viewing situations,
from a single display. It gives development teams a simple framework for
design decisions about legibility and accessibility — e.g. "how big is
this 27″/70cm design when it's a Switch 2 at 40cm?"

## 2. Core concepts

- **This Device** — the display the app is being viewed on. It must be
  calibrated (diagonal, resolution, viewing distance) for every other
  reading to be honest. A first-run onboarding assistant walks through
  it (welcome → screen size → viewing stance); "Run setup assistant
  again" and a standalone "Calibrate screen size…" live in Settings
  afterward. Screen size can be typed in, chosen from a monitor/TV
  preset, or measured by dragging a bank-card shape on screen to match
  a real ID-1 card held against the panel (edges and corners are
  draggable, keyboard-operable, with a coarse slider and a
  browser-zoom sanity check).
- **Test Devices** — instances of device details (from presets or
  custom specs) with per-instance name, key color, distance, and
  visibility; the same preset can be added twice at different
  distances. Each device also carries a **fit mode** (contain /
  fill-width / fill-height / stretch — how it reconciles its aspect
  ratio against the active media's), optional **curvature**
  (industry `R` radius), a per-stance **height offset** from the
  viewer's eye line, and per-stance **tilt** with an **auto-orient**
  option that pitches the screen to face the eye directly (on by
  default for handhelds/phones/tablets, off for monitors/TVs/
  projectors).
- **Arc minutes** — the canonical unit. Everything (screens, fonts,
  measured text) is expressed as the angle it subtends at the eye, so
  sizes compare honestly across wildly different panels and distances.

## 3. Key features

### Workbench panel
A single floating, resizable popup with three tabs — **Devices**,
**Media**, **Perception Report** — so cross-references between them are
a tab switch, not window juggling. Hotkeys `D`/`M`/`P` jump straight to
a tab; all three stay mounted so scroll position and in-flight scans
survive switching.

**Device Manager tab** — This Device section plus the Test Devices
list: collapsed rows show visibility, key color, name, and a distance
slider; expanded rows add diagonal size, aspect/resolution, fit mode,
curvature, height offset, tilt/auto-orient, and delete. Presets cover
handhelds, phones, monitors, and TVs, plus generics for custom specs.
Persisted to localStorage.

**Media Library tab** — drag-and-drop import of images, video, and GIF
(stored as blobs in IndexedDB, never uploaded), plus generated test
cards (color bars, alignment grid, gradient, solid gray) and, when
present, local sample screenshots. Each item carries a **source crop**
(one crop, applied everywhere the item is shown) and a **reference
height** (the resolution class it was authored at, e.g. 1080p).
Timeline media (video/GIF) has transport controls and playback.
**OCR text detection** runs fully offline (vendored Tesseract.js) —
automatically, queued one at a time, on every imported item, and for
timeline media again on every keyframe the user places on the
timeline (`<`/`>` jump between them, pausing playback; a scan holds
until the next keyframe). Detected lines become regular **measure
boxes** that flow into the 2D overlay and the Perception Report, with
descender-aware text grouping so a line without descenders doesn't
under-report its font size. Measure boxes can also be hand-drawn.

**Perception Report tab** — the product's thesis made concrete: what
reads comfortably on the screen you designed on may not read at all
elsewhere. A Miller-column layout lists every device (This Device
"blessed" and shown first) against the scanned/measured text of the
active media, giving each line a color-coded verdict against the
ISO 9241-303 bands (16′ minimum, 20–22′ comfortable). A device on
`stretch` fit gets a visible warning that its arc-minute figures are
vertical-only, since stretch is the one anamorphic mode.

### Comparison table
A standalone panel (hotkey `C`) — the live version of the arc-minute
spreadsheet: every device's size, distance, angular extent, PPD (with
sub-retina <60 flagged), arcmin/px, PPI, and apparent-size ratio versus
This Device, sortable by column, exportable as CSV.

### 2D display area
Full-bleed. Two display modes: **viewport** (the window is a true-scale
slice of This Device's physical panel, tracked to the window's position
on screen) and **fit** (the whole composition shrinks to fit the
window). Viewport mode can center on the physical screen or the browser
window; a manual pan (drag) applies on top of either, double-click
recenters. A browser-zoom estimate (comparing `devicePixelRatio` against
the real screen width) warns when zoom isn't at 100%, since physical
scale depends on it. The current view exports as a PNG reference image.

### 3D view
The same comparison in space: a viewer figure with **stance**
(standing / on a couch / at a desk, driving eye height and the modeled
environment) and **input type** (handheld / gamepad / mouse & keyboard,
driving the figure's arms), optionally linked so stance and input
change together. Every visible device renders as a color-keyed panel at
its true physical size, distance, tilt, and curvature, with optional
eye-to-corner projection lines and device labels. Scene theme follows
the UI or can be set independently; an FPS readout and a PNG export of
the current framing sit in the HUD.

### Settings
Units (inches ⇄ centimeters), UI theme and 3D scene theme, device
display fill (black or device-color when no image is shown), a toggle
for the ISO legibility color bands in readouts, a color-vision-deficiency
simulation (protanopia/deuteranopia/tritanopia/achromatopsia, Machado
et al. matrices) over the 2D and 3D views, local storage usage, and
setup **export/import as JSON** (This Device, test devices, and the
relevant settings/viewer state — versioned, validated on import).
Destructive actions (reset all settings, wipe local data) are separated
below a rule and require confirmation. A persistent privacy statement
notes nothing is uploaded or tracked.

### Hotkeys
`D`/`M`/`P` switch Workbench tabs; `C`/`S` toggle the Comparison table
and Settings; `Tab` flips 2D/3D; `1`/`2`/`3` set stance, `Q`/`W`/`E` set
input type; drag pans the 2D composition (click still selects),
double-click recenters; `←`/`→` walk the media library, `↑`/`↓` cycle
the focused visible device; `Space` plays/pauses timeline media,
`<`/`>` jump between OCR keyframes; `X` toggles a crop on the active
media; `Esc` deselects or closes the cheat sheet; `?` opens it. Hotkeys
are suppressed while typing in a field or inside an open menu/dialog.

### Flagged features
`lib/flags.ts` parks work that exists in code but isn't shipping yet:
3D handheld/gamepad chassis bodies around the screens, pinning a
device's details into a floating window, and a collapse toggle on the
Workbench's column divider.

## 4. Non-goals

- No remote data storage, backend, auth, or tracking.
- No real-time collaboration.

## 5. Technical

Next.js 16 (App Router) + TypeScript + Bun, Tailwind v4 + shadcn
(base-ui primitives), three.js/R3F/drei for the 3D view, zustand
(persisted to localStorage) for state, IndexedDB for media blobs,
Tesseract.js vendored locally for offline OCR, static export to GitHub
Pages (`wiki/notes/decision-github-pages-deploy.md`).

## 6. Milestones

**Shipped (tagged v0.1.0 through v0.7.0):** device management UI ·
image/video/GIF import with local OCR · 2D overlay at correct relative
scale, viewport/fit modes, pan, PNG export · 3D view with stances,
input types, and projection lines · Perception Report with ISO-band
verdicts · comparison table with CSV export · local persistence, unit
toggle, CVD simulation, settings/wipe · setup export/import.

**On `dev`, unreleased:** per-device fit modes (fill-width/fill-height/
stretch) split from source crop · per-stance tilt and auto-orient ·
the calibration overhaul (onboarding assistant, bank-card screen
sizing) · arrow-key device/media navigation · automatic OCR on import
and on video/GIF keyframes. Promotion to `main` is on Taylor's word.

**Open (tracked as GitHub issues, not scheduled):** #1 review of the
features parked behind flags · #4 viewing distance without a tape
measure · #5 what screen auto-detection the browser can honestly
support · #8 a display setup wizard · #9/#10 browser-zoom handling
(the Firefox warning gap and letting zoom scale UI chrome without
touching content's true size) · #11 auto-OCR follow-ups (aborting an
in-flight scan, deduping re-imports). Longer-term and explicitly
unscheduled: 9-slice content adaptation
(`wiki/notes/plan-content-adaptation-nine-slice.md`) — fit modes are a
deliberately crude stand-in for how real game UI actually re-lays-out
across aspect ratios.

## 7. Success metrics

- Accurate relative scale across devices (validated against the
  arc-minute sheet).
- Adoption by 3–5 professionals in target fields during beta.
- Use in 1+ portfolio or production project.
