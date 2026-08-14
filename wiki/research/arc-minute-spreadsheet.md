---
tags: [domain/display-math, origin/external-research, status/verified]
---

# Arc-Minute Spreadsheet (Disco Elysium Font Sizing)

Source: Figma → Wright Angles → "Reference Image" page → "Group 3".
This sheet was the foundation for the three main font sizes in **Disco
Elysium: The Final Cut** on console and handheld. It is the ground truth
for `lib/display-math.ts`; the unit tests pin to its rows.

## Column pipeline

Size (in) · Res W/H → Res Total · Diag Pix · **PPI** · Dot Pitch ·
Dist (cm) · Font (pt) · ~pt to px · Font (in) · Font (mm) · **Arc Min**

i.e. font point size → rendered pixels → physical size on that panel →
angle subtended at the viewing distance. Rows flush red when arc minutes
dip too low (console rows at 3m land around 10–17).

## Pinned rows (used in tests)

| Device | Size | Res | Dist | Font px | Font mm | Arc min |
|---|---|---|---|---|---|---|
| Switch Lite | 5.5″ | 1280×720 | 36cm | 22 | 2.093 | **20** |
| Switch | 6.2″ | 1280×720 | 36cm | 22 | 2.359 | **23** |
| 1080p PC 24″ | 24″ | 1920×1080 | 70cm | 17 | 4.704 | **23** |

Handhelds sit at 36cm, TVs at 200–300cm, PCs at 70cm. The formula is the
exact subtense `2·atan(size / 2·distance)`, not the small-angle shortcut.

## What the sheet implies for the product

- The tool's font/highlight measurements should report arc minutes with
  the same pipeline (px → mm → arcmin).
- Threshold flagging (the red cells) becomes the legibility warning
  feature — see [[decision-arcminute-rosetta-stone]].
