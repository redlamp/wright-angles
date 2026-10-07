import { formatDistance, simulatedSizeOnHostPx } from "@/lib/display-math";
import { deviceFitCrop, fitBox, fitModeOf } from "@/lib/fit";
import { FULL_CROP } from "@/lib/media-crop";
import type { DisplayFill } from "@/stores/settings-store";
import type { Device, LengthUnit, MediaItem } from "@/lib/types";

// Snapshot the composition at This Device's native resolution — a
// shareable reference PNG of the comparison (poster frame for videos).
export async function exportViewPng({
  thisDevice,
  devices,
  activeUrl,
  activeItem,
  displayFill,
  unit,
}: {
  thisDevice: Device;
  devices: Device[];
  activeUrl: string | null;
  activeItem: MediaItem | null;
  displayFill: DisplayFill;
  unit: LengthUnit;
}) {
  const host = thisDevice;
  const W = host.resolution.w;
  const H = host.resolution.h;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#161616";
  g.fillRect(0, 0, W, H);

  const all: (Device & { isThis?: boolean })[] = [
    ...(host.visible ? [{ ...host, isThis: true }] : []),
    ...devices.filter((d) => d.visible),
  ];
  const rectList = all
    .map((d) => {
      const sim = d.isThis
        ? { widthPx: W, heightPx: H }
        : simulatedSizeOnHostPx(d, host);
      return { d, w: sim.widthPx, h: sim.heightPx };
    })
    .sort((a, b) => b.w * b.h - a.w * a.h);

  let img: HTMLImageElement | null = null;
  if (activeUrl) {
    img = new Image();
    img.src = activeUrl;
    await new Promise((res) => {
      img!.onload = res;
      img!.onerror = res;
    });
    if (!img.naturalWidth) img = null;
  }

  for (const { d, w, h } of rectList) {
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    if (img) {
      g.fillStyle = "#000";
      g.fillRect(x, y, w, h);
      // Draw only this device's rendered crop window (source crop
      // reframed by its fit mode; full frame when neither applies).
      const c = activeItem ? deviceFitCrop(activeItem, d) : FULL_CROP;
      const sw = c.w * img.naturalWidth;
      const sh = c.h * img.naturalHeight;
      // Same fitBox the on-screen rect uses, so the export is the
      // screenshot it claims to be — a stretched device fills its rect.
      const a = fitBox(fitModeOf(d), sw, sh, w, h);
      g.drawImage(
        img,
        c.x * img.naturalWidth,
        c.y * img.naturalHeight,
        sw,
        sh,
        x + a.x,
        y + a.y,
        a.w,
        a.h,
      );
    } else {
      g.fillStyle =
        displayFill === "device-color" ? d.color : "rgba(0,0,0,0.5)";
      g.fillRect(x, y, w, h);
    }
    g.strokeStyle = d.color;
    g.lineWidth = Math.max(2, W / 800);
    g.strokeRect(x, y, w, h);
    g.fillStyle = d.color;
    g.font = `${Math.max(16, Math.round(W / 90))}px monospace`;
    const label = `${d.label} · ${formatDistance(d.distanceCm, unit)}`;
    g.fillText(label, x + 8, y > 30 ? y - 8 : y + 26);
  }

  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = `${Math.max(13, Math.round(W / 110))}px monospace`;
  g.fillText(
    `Wright Angles — host: ${host.label} ${W}×${H} @ ${formatDistance(host.distanceCm, unit)}`,
    16,
    H - 16,
  );

  const blob = await new Promise<Blob | null>((r) =>
    c.toBlob(r, "image/png"),
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wright-angles-view-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
  // Deferred: revoking synchronously after click() can beat Firefox/
  // Safari to actually starting the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
