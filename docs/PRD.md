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

- **This Device** — the display the app is being viewed on. Calibrating
  it (size, resolution, distance) is required for the tool to work.
- **Test Devices** — instances of device details (from presets or custom)
  with per-instance name, key color, distance, and visibility. The same
  device can be added twice at different distances.
- **Arc minutes** — the canonical unit. Everything (screens, fonts,
  highlight rects) is measured as the angle it subtends at the eye.

## 3. Key features

### Display Area
Full-bleed; ideally used full-screen. Shows the selected image scaled for
This Device; every visible test device renders the image at its correct
relative angular scale, outlined in its key color.

### Device Manager (floating, draggable panel)
- This Device section + Test Devices list.
- Collapsed row: visibility eye, color keyline, name, distance
  slider + value — distance stays adjustable without expanding.
- Expanded: label, device name, key color, diagonal size (slider + field,
  in/cm), aspect-ratio dropdown with common resolutions, width/height px,
  delete.
- Presets for handhelds, phones, monitors, TVs; generics for custom.
- Persists to localStorage. No remote storage.

### Media Library (floating panel)
- Drag-and-drop images; stored in IndexedDB, never uploaded.
- Thumbnail grid; select the active image; images carry a reference size
  (e.g. 1080p) describing the resolution they were authored at.
- Future: highlight rectangles for text measurement (arcmin readout),
  multiple-image switching, stream embeds.

### Side Bar
Slim icon rail toggling Device Manager, Media Library, App Info (arc
minute explainer), and Settings.

### Settings
- Units: inches ⇄ centimeters (decimal inches mandatory).
- Privacy statement: no remote storage or tracking.
- Wipe local data.

### 3D View
Alternate view: viewer figure, sight line, each visible device as a
color-keyed rectangle at its physical size and distance, with distance
markers. Gives a spatial sense of the same comparison.

## 4. Non-goals

- No remote data storage, backend, auth, or tracking.
- No real-time collaboration.

## 5. Technical

Next.js 16 + TypeScript + Bun, Tailwind v4 + shadcn, three.js/R3F/drei,
zustand; localStorage + IndexedDB; static export to GitHub Pages
(`wiki/notes/decision-github-pages-deploy.md`).

## 6. Milestones

**MVP:** device management UI · image import + scaled preview · 2D
overlay at correct relative scale · 3D view · local persistence · unit
toggle · settings/wipe.

**Post-MVP:** highlight rectangles + legibility grading (arcmin
thresholds) · multi-image hot-zone switching · stream embedding ·
export/share device setups.

## 7. Success metrics

- Accurate relative scale across devices (validated against the
  arc-minute sheet).
- Adoption by 3–5 professionals in target fields during beta.
- Use in 1+ portfolio or production project.
