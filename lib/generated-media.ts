/**
 * Built-in test cards (color bars, grid, gradient, solid): the kind list,
 * the canvas renderer, and the metadata a generated item is stored with.
 * drawGenerated needs a DOM; the rest is plain data.
 */
import type { MediaItem } from "@/lib/types";
import { GRADIENT_SEED_SCAN } from "@/lib/gradient-seed-scan";

export type GeneratedKind = "smpte-bars" | "grid" | "gradient" | "solid";

export const GENERATED_KINDS: { kind: GeneratedKind; label: string }[] = [
  { kind: "smpte-bars", label: "Color bars" },
  { kind: "grid", label: "Alignment grid" },
  { kind: "gradient", label: "Gradient card" },
  { kind: "solid", label: "Solid gray" },
];

/** Draw a 1920×1080 test image. Pure canvas; no assets. */
export function drawGenerated(kind: GeneratedKind): HTMLCanvasElement {
  const W = 1920;
  const H = 1080;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  if (kind === "smpte-bars") {
    const bars = [
      "#c0c0c0", "#c0c000", "#00c0c0", "#00c000",
      "#c000c0", "#c00000", "#0000c0",
    ];
    const w = W / bars.length;
    bars.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(i * w, 0, w + 1, H * 0.75);
    });
    const lower = ["#0000c0", "#131313", "#c000c0", "#131313", "#00c0c0", "#131313", "#c0c0c0"];
    const lw = W / lower.length;
    lower.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(i * lw, H * 0.75, lw + 1, H * 0.125);
    });
    const grays = 12;
    for (let i = 0; i < grays; i++) {
      const v = Math.round((i / (grays - 1)) * 255);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect((i * W) / grays, H * 0.875, W / grays + 1, H * 0.125);
    }
  } else if (kind === "grid") {
    g.fillStyle = "#1c1c1c";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#3d3d3d";
    g.lineWidth = 1;
    for (let x = 0; x <= W; x += 60) {
      g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke();
    }
    for (let y = 0; y <= H; y += 60) {
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke();
    }
    g.strokeStyle = "#7a7a7a";
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, H / 3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#e5e5e5";
    g.font = "500 40px sans-serif";
    g.fillText("1920 × 1080", 40, 70);
  } else if (kind === "gradient") {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#b23a3a");
    grad.addColorStop(1, "#3ab26e");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff";
    const sizes = [48, 36, 28, 22, 17, 13];
    let y = 100;
    for (const s of sizes) {
      g.font = `600 ${s}px sans-serif`;
      g.fillText(`${s}px — The quick brown fox jumps over the lazy dog`, 60, y);
      y += s * 1.8;
    }
  } else {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, W, H);
  }
  return c;
}

/**
 * Metadata for a freshly generated test card (id/size/time supplied by
 * the caller, so this stays pure).
 */
export function generatedItemMeta(
  kind: GeneratedKind,
  id: string,
  width: number,
  height: number,
  addedAt: number,
): MediaItem {
  const label = GENERATED_KINDS.find((k) => k.kind === kind)?.label ?? kind;
  const meta: MediaItem = {
    id,
    name: `${label} (generated)`,
    type: "image/png",
    kind: "image",
    width,
    height,
    referenceHeight: height,
    addedAt,
  };
  if (kind === "gradient") {
    // The gradient card's draw is deterministic, so its OCR result is
    // pinned data rather than a live scan (wiki/research/ocr-cost.md) —
    // ships identically whether this is the first-run seed or a manual
    // "Test → Gradient card". `boxes` is derived the same way
    // detectTextForItem's live path builds it, so the overlay/report
    // treat a seeded card exactly like a freshly scanned one.
    meta.scan = GRADIENT_SEED_SCAN;
    meta.boxes = GRADIENT_SEED_SCAN.lines.map((line) => ({
      id: line.id,
      label: line.text,
      ...line.box,
    }));
  }
  return meta;
}
