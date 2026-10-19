/**
 * The static half of the legibility test card: everything that is
 * relative to the SCREEN rather than the viewer (safe-area frames,
 * contrast swatches, confusable glyphs, pixel-pitch patches). The
 * viewer-relative half, optotypes and text sized in arc minutes, can't
 * be baked into pixels; it draws live per device from
 * components/display-area/acuity-ladder.tsx into the space this card
 * leaves free on its right.
 *
 * Needs a canvas context; no other DOM.
 */
import {
  AAA_NORMAL,
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  grayForContrast,
  relativeLuminance,
} from "@/lib/contrast";

const FONT = "sans-serif";

/** Swatch ratios, strongest first, with the threshold each one marks. */
export const CONTRAST_SWATCHES: { ratio: number; label: string }[] = [
  { ratio: AAA_NORMAL, label: "AAA" },
  { ratio: AA_NORMAL, label: "AA" },
  { ratio: AA_LARGE, label: "AA large" },
  { ratio: 2, label: "fails" },
  { ratio: 1.5, label: "fails" },
];

/** Glyph pairs that collapse first as text shrinks. */
export const CONFUSABLES = "Il1| O0o rn m cl d 8B 5S 2Z gq ,.";

/**
 * Where the live acuity ladder sits, as fractions of the screen. The
 * card draws a placeholder here and the overlay anchors to the same
 * box, so on a 16:9 panel the two line up.
 */
export const LADDER_BOX = { left: 0.53, top: 0.12, right: 0.05, bottom: 0.07 };

const hex = (v: number) => `rgb(${v},${v},${v})`;

function drawSafeAreas(g: CanvasRenderingContext2D, W: number, H: number) {
  g.setLineDash([16, 10]);
  g.lineWidth = 2;
  // SMPTE ST 2046-1 action-safe 93%, then title-safe 90% (also the 5%
  // per-edge margin Android TV and Fire TV ask for).
  const frames = [
    { inset: 0.035, color: "#bdbdbd", text: "action safe 93%" },
    { inset: 0.05, color: "#f5a524", text: "title safe 90% · Android TV / Fire TV 5%" },
  ];
  g.font = `500 18px ${FONT}`;
  for (const f of frames) {
    const x = W * f.inset;
    const y = H * f.inset;
    g.strokeStyle = f.color;
    g.strokeRect(x, y, W - 2 * x, H - 2 * y);
    g.fillStyle = f.color;
    g.fillText(`${f.text} (${Math.round(x)} × ${Math.round(y)} px)`, x + 8, y - 6);
  }
  g.setLineDash([]);
}

function drawContrast(g: CanvasRenderingContext2D, x0: number, y0: number) {
  g.fillStyle = "#e5e5e5";
  g.font = `600 26px ${FONT}`;
  g.fillText("Contrast vs WCAG / XAG floors", x0, y0);
  const backgrounds = [32, 232];
  const sw = 150;
  const sh = 104;
  const gap = 14;
  backgrounds.forEach((bg, row) => {
    const bgLum = relativeLuminance(bg, bg, bg);
    const y = y0 + 22 + row * (sh + 44);
    CONTRAST_SWATCHES.forEach(({ ratio, label }, i) => {
      const x = x0 + i * (sw + gap);
      g.fillStyle = hex(bg);
      g.fillRect(x, y, sw, sh);
      const fg = grayForContrast(bgLum, ratio);
      if (fg === null) return;
      g.fillStyle = hex(fg);
      g.font = `600 44px ${FONT}`;
      g.fillText("Aa", x + 14, y + 54);
      g.font = `500 18px ${FONT}`;
      g.fillText("Body 18px", x + 14, y + 86);
      const actual = contrastRatio(relativeLuminance(fg, fg, fg), bgLum);
      g.fillStyle = "#bdbdbd";
      g.font = `500 17px ${FONT}`;
      g.fillText(`${actual.toFixed(2)}:1 ${label}`, x, y + sh + 24);
    });
  });
}

function drawGlyphs(g: CanvasRenderingContext2D, x0: number, y0: number) {
  g.fillStyle = "#e5e5e5";
  g.font = `600 26px ${FONT}`;
  g.fillText("Confusable glyphs", x0, y0);
  let y = y0 + 12;
  for (const px of [40, 28, 20, 14]) {
    y += px * 1.5;
    g.fillStyle = "#8a8a8a";
    g.font = `500 16px ${FONT}`;
    g.fillText(`${px}px`, x0, y);
    g.fillStyle = "#f2f2f2";
    g.font = `500 ${px}px ${FONT}`;
    g.fillText(CONFUSABLES, x0 + 60, y);
  }
}

/** Black/white patches at 1–3 px pitch: where the panel, not the eye,
 * runs out of detail (pair with the pixel loupe). */
function drawPixelPatches(g: CanvasRenderingContext2D, x0: number, y0: number) {
  g.fillStyle = "#e5e5e5";
  g.font = `600 26px ${FONT}`;
  g.fillText("Pixel pitch", x0, y0);
  const S = 110;
  const gap = 24;
  const patches: { label: string; on: (x: number, y: number) => boolean }[] = [
    { label: "1px rows", on: (_x, y) => y % 2 === 0 },
    { label: "1px cols", on: (x) => x % 2 === 0 },
    { label: "1px checker", on: (x, y) => (x + y) % 2 === 0 },
    { label: "2px rows", on: (_x, y) => y % 4 < 2 },
    { label: "3px cols", on: (x) => x % 6 < 3 },
  ];
  const y = y0 + 18;
  patches.forEach((p, i) => {
    const x = x0 + i * (S + gap);
    g.fillStyle = "#000";
    g.fillRect(x, y, S, S);
    g.fillStyle = "#fff";
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        if (p.on(px, py)) g.fillRect(x + px, y + py, 1, 1);
      }
    }
    g.fillStyle = "#bdbdbd";
    g.font = `500 17px ${FONT}`;
    g.fillText(p.label, x, y + S + 22);
  });
}

function drawLadderPlaceholder(g: CanvasRenderingContext2D, W: number, H: number) {
  const x = W * LADDER_BOX.left;
  const y = H * LADDER_BOX.top;
  const w = W * (1 - LADDER_BOX.left - LADDER_BOX.right);
  const h = H * (1 - LADDER_BOX.top - LADDER_BOX.bottom);
  g.fillStyle = "#1f1f1f";
  g.fillRect(x, y, w, h);
  g.fillStyle = "#5c5c5c";
  g.font = `500 20px ${FONT}`;
  g.textAlign = "center";
  g.fillText("Acuity ladder draws here, live per device", x + w / 2, y + h / 2);
  g.font = `500 16px ${FONT}`;
  g.fillText("(sized in arc minutes for each viewer's distance)", x + w / 2, y + h / 2 + 28);
  g.textAlign = "start";
}

export function drawLegibilityCard(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
) {
  g.fillStyle = "#161616";
  g.fillRect(0, 0, W, H);
  drawSafeAreas(g, W, H);
  const x0 = Math.round(W * 0.07);
  g.fillStyle = "#f2f2f2";
  g.font = `600 44px ${FONT}`;
  g.fillText("Legibility card", x0, 128);
  g.fillStyle = "#9a9a9a";
  g.font = `500 20px ${FONT}`;
  g.fillText(`${W} × ${H} · screen-relative checks; arc-minute rows live at right`, x0, 160);
  drawContrast(g, x0, 222);
  drawGlyphs(g, x0, 560);
  drawPixelPatches(g, x0, 842);
  drawLadderPlaceholder(g, W, H);
}
