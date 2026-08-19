"use client";

import { create } from "zustand";
import type {
  HighlightBox,
  KeyframeLine,
  MediaCrop,
  MediaItem,
  ScanKeyframe,
} from "@/lib/types";
import {
  idbClearMedia,
  idbDeleteMedia,
  idbGetAllMedia,
  idbPutMedia,
} from "@/lib/idb";
import { stripImageMetadata } from "@/lib/strip-metadata";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** Re-write an item's metadata beside its stored blob(s). */
function persistMeta(get: () => { items: MediaItem[] }, id: string) {
  const item = get().items.find((i) => i.id === id);
  if (!item) return;
  void idbGetAllMedia().then((records) => {
    const rec = records.find((r) => r.meta.id === id);
    if (rec) void idbPutMedia(id, { ...rec, meta: item });
  });
}

/** Intrinsic pixel size of an image blob. */
function probeImage(blob: Blob): Promise<{ width: number; height: number }> {
  return createImageBitmap(blob).then((bmp) => {
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  });
}

/**
 * Video metadata + a poster frame. Hard 10s timeout with teardown on
 * every path — an element that never fires events must not leak or hang
 * the import loop.
 */
function probeVideo(blob: Blob): Promise<{
  width: number;
  height: number;
  duration: number;
  poster: Blob;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    const cleanup = () => {
      clearTimeout(timer);
      v.removeAttribute("src");
      v.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("video probe timeout"));
    }, 10_000);
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(1, (v.duration || 0) / 2);
    };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const { videoWidth, videoHeight, duration } = v;
      c.toBlob(
        (poster) => {
          cleanup();
          if (poster) {
            resolve({ width: videoWidth, height: videoHeight, duration, poster });
          } else {
            reject(new Error("poster capture failed"));
          }
        },
        "image/jpeg",
        0.8,
      );
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("video load error"));
    };
    v.src = url;
  });
}

interface MediaState {
  items: MediaItem[];
  /**
   * Runtime-only object URLs for thumbnails/stills (poster frame for
   * videos), keyed by media id. Revoked on remove.
   */
  objectUrls: Record<string, string>;
  /** Playable object URLs for video items only. */
  videoUrls: Record<string, string>;
  activeId: string | null;
  hydrated: boolean;
  /** Load persisted media from IndexedDB. Call once on mount. */
  hydrate: () => Promise<void>;
  addFiles: (files: FileList | File[]) => Promise<void>;
  /** Create a built-in test image (rendered to canvas, stored like any import). */
  addGenerated: (kind: GeneratedKind) => Promise<void>;
  rename: (id: string, name: string) => void;
  addBox: (mediaId: string, box: HighlightBox) => void;
  updateBox: (
    mediaId: string,
    boxId: string,
    patch: Partial<HighlightBox>,
  ) => void;
  removeBox: (mediaId: string, boxId: string) => void;
  remove: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  setReferenceHeight: (id: string, referenceHeight: number) => void;
  /** Set or clear (undefined) the item's crop window. */
  setCrop: (id: string, crop: MediaCrop | undefined) => void;
  /**
   * Set or clear (undefined) one device's crop override on the item.
   * Overrides are full-image normalized like the media crop; clearing
   * the last one drops the deviceCrops key entirely.
   */
  setDeviceCrop: (
    id: string,
    deviceId: string,
    crop: MediaCrop | undefined,
  ) => void;
  /** Drop a deleted device's crop overrides from every item. */
  pruneDeviceCrops: (deviceId: string) => void;
  /**
   * Nuke every detection artifact on the item: ALL measure boxes
   * (including hand-drawn — stale unlabeled scan boxes are
   * indistinguishable) and every scan keyframe.
   */
  /** Move an item to a library position; persists the manual order. */
  reorderItem: (id: string, toIndex: number) => void;
  clearDetection: (id: string) => void;
  /** Persist (or clear) an image's one-shot scan on the item. */
  setScan: (
    id: string,
    scan: { lines: KeyframeLine[]; medianPx: number } | undefined,
  ) => void;
  /** Replace the item's OCR keyframe list (empty/undefined clears it). */
  setScanKeyframes: (
    id: string,
    scanKeyframes: ScanKeyframe[] | undefined,
  ) => void;
  wipeAll: () => Promise<void>;
}

export type GeneratedKind = "smpte-bars" | "grid" | "gradient" | "solid";

/**
 * First-run seeding flag: a never-seeded browser with an empty library
 * gets the gradient card so the app demonstrates itself. Deleting the
 * card is a choice — the flag survives, so it never resurrects on
 * reload. Wiping local data clears the flag: a wipe means "fresh
 * visitor", seed and all.
 */
const SEED_KEY = "wright-angles:seeded";
/** Active selection survives reloads (Taylor 2026-08-18). */
const ACTIVE_KEY = "wright-angles:active-media";
const rememberActive = (id: string | null) => {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Session-only environment.
  }
};
const recallActive = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};
const wasSeeded = () => {
  try {
    return localStorage.getItem(SEED_KEY) !== null;
  } catch {
    return true; // no localStorage → don't keep re-seeding every load
  }
};
const markSeeded = () => {
  try {
    localStorage.setItem(SEED_KEY, "1");
  } catch {
    // Session-only environment; seeding once this session is fine.
  }
};

export const GENERATED_KINDS: { kind: GeneratedKind; label: string }[] = [
  { kind: "smpte-bars", label: "Color bars" },
  { kind: "grid", label: "Alignment grid" },
  { kind: "gradient", label: "Gradient card" },
  { kind: "solid", label: "Solid gray" },
];

/** Draw a 1920×1080 test image. Pure canvas; no assets. */
function drawGenerated(kind: GeneratedKind): HTMLCanvasElement {
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

export const useMediaStore = create<MediaState>()((set, get) => ({
  items: [],
  objectUrls: {},
  videoUrls: {},
  activeId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const records = await idbGetAllMedia();
      const urls: Record<string, string> = {};
      const vids: Record<string, string> = {};
      const items = records
        .map((r) => {
          // Records from before video support lack `kind`.
          const meta: MediaItem = { ...r.meta, kind: r.meta.kind ?? "image" };
          if (meta.kind === "video") {
            urls[meta.id] = URL.createObjectURL(r.poster ?? r.blob);
            vids[meta.id] = URL.createObjectURL(r.blob);
          } else {
            urls[meta.id] = URL.createObjectURL(r.blob);
          }
          return meta;
        })
        // Manual order wins; items never reordered keep insertion order
        // (sortIndex is a small int, addedAt an epoch — unordered items
        // sort after every manually placed one, i.e. append).
        .sort(
          (a, b) =>
            (a.sortIndex ?? a.addedAt) - (b.sortIndex ?? b.addedAt),
        );
      // The remembered selection wins over "first item" — a refresh
      // must not hop back to whatever sorts first.
      const remembered = recallActive();
      const rememberedValid =
        remembered !== null && items.some((i) => i.id === remembered)
          ? remembered
          : null;
      set((s) => ({
        items,
        objectUrls: urls,
        videoUrls: vids,
        hydrated: true,
        activeId: s.activeId ?? rememberedValid ?? items[0]?.id ?? null,
      }));
      // First run: seed the gradient card as the default image.
      if (items.length === 0 && !wasSeeded()) {
        markSeeded();
        await get().addGenerated("gradient");
      }
    } catch {
      // IndexedDB unavailable (private browsing edge cases) — run
      // session-only with an empty library.
      set({ hydrated: true });
    }
  },

  addFiles: async (files) => {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (list.length > 0 && navigator.storage?.persist) {
      // Ask the browser not to evict the library under storage pressure.
      // Fire-and-forget: denial just means default (best-effort) durability.
      void navigator.storage.persist();
    }
    for (const file of list) {
      try {
        if (file.type.startsWith("video/")) {
          const { width, height, duration, poster } = await probeVideo(file);
          const meta: MediaItem = {
            id: newId(),
            name: file.name,
            type: file.type,
            kind: "video",
            duration,
            width,
            height,
            referenceHeight: height,
            addedAt: Date.now(),
          };
          await idbPutMedia(meta.id, { meta, blob: file, poster });
          set((s) => ({
            items: [...s.items, meta],
            objectUrls: {
              ...s.objectUrls,
              [meta.id]: URL.createObjectURL(poster),
            },
            videoUrls: {
              ...s.videoUrls,
              [meta.id]: URL.createObjectURL(file),
            },
            activeId: s.activeId ?? meta.id,
          }));
        } else {
          // Static images (JPEG/PNG/WebP) are re-encoded to shed
          // EXIF/GPS metadata before they touch IndexedDB; GIFs and
          // anything else pass through untouched. Falls back to the
          // original bytes on any failure.
          const blob = await stripImageMetadata(file);
          const { width, height } = await probeImage(blob);
          const meta: MediaItem = {
            id: newId(),
            name: file.name,
            type: file.type,
            kind: "image",
            width,
            height,
            referenceHeight: height,
            addedAt: Date.now(),
          };
          await idbPutMedia(meta.id, { meta, blob });
          const url = URL.createObjectURL(blob);
          set((s) => ({
            items: [...s.items, meta],
            objectUrls: { ...s.objectUrls, [meta.id]: url },
            activeId: s.activeId ?? meta.id,
          }));
        }
      } catch {
        // Not decodable as an image/video — skip silently.
      }
    }
  },

  addGenerated: async (kind) => {
    const canvas = drawGenerated(kind);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/png"),
    );
    if (!blob) return;
    const label = GENERATED_KINDS.find((k) => k.kind === kind)?.label ?? kind;
    const meta: MediaItem = {
      id: newId(),
      name: `${label} (generated)`,
      type: "image/png",
      kind: "image",
      width: canvas.width,
      height: canvas.height,
      referenceHeight: canvas.height,
      addedAt: Date.now(),
    };
    await idbPutMedia(meta.id, { meta, blob });
    const url = URL.createObjectURL(blob);
    set((s) => ({
      items: [...s.items, meta],
      objectUrls: { ...s.objectUrls, [meta.id]: url },
      activeId: s.activeId ?? meta.id,
    }));
  },

  rename: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, name: trimmed } : i)),
    }));
    persistMeta(get, id);
  },

  addBox: (mediaId, box) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.id === mediaId ? { ...i, boxes: [...(i.boxes ?? []), box] } : i,
      ),
    }));
    persistMeta(get, mediaId);
  },

  updateBox: (mediaId, boxId, patch) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.id === mediaId
          ? {
              ...i,
              boxes: (i.boxes ?? []).map((b) =>
                b.id === boxId ? { ...b, ...patch } : b,
              ),
            }
          : i,
      ),
    }));
    persistMeta(get, mediaId);
  },

  removeBox: (mediaId, boxId) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.id === mediaId
          ? { ...i, boxes: (i.boxes ?? []).filter((b) => b.id !== boxId) }
          : i,
      ),
    }));
    persistMeta(get, mediaId);
  },

  remove: async (id) => {
    await idbDeleteMedia(id);
    set((s) => {
      for (const map of [s.objectUrls, s.videoUrls]) {
        if (map[id]) URL.revokeObjectURL(map[id]);
      }
      const objectUrls = { ...s.objectUrls };
      const videoUrls = { ...s.videoUrls };
      delete objectUrls[id];
      delete videoUrls[id];
      const items = s.items.filter((i) => i.id !== id);
      return {
        items,
        objectUrls,
        videoUrls,
        activeId:
          s.activeId === id ? (items[0]?.id ?? null) : s.activeId,
      };
    });
  },

  setActive: (id) => {
    rememberActive(id);
    set({ activeId: id });
  },

  setReferenceHeight: (id, referenceHeight) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, referenceHeight } : i)),
    }));
    persistMeta(get, id);
  },

  setCrop: (id, crop) => {
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i;
        if (!crop) {
          // Drop the key entirely so cleared items persist crop-free.
          const rest = { ...i };
          delete rest.crop;
          return rest;
        }
        return { ...i, crop };
      }),
    }));
    persistMeta(get, id);
  },

  setDeviceCrop: (id, deviceId, crop) => {
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i;
        const next = { ...(i.deviceCrops ?? {}) };
        if (crop) next[deviceId] = crop;
        else delete next[deviceId];
        const rest = { ...i };
        if (Object.keys(next).length > 0) rest.deviceCrops = next;
        else delete rest.deviceCrops;
        return rest;
      }),
    }));
    persistMeta(get, id);
  },

  pruneDeviceCrops: (deviceId) => {
    const touched: string[] = [];
    set((s) => ({
      items: s.items.map((i) => {
        if (!i.deviceCrops?.[deviceId]) return i;
        touched.push(i.id);
        const next = { ...i.deviceCrops };
        delete next[deviceId];
        const rest = { ...i };
        if (Object.keys(next).length > 0) rest.deviceCrops = next;
        else delete rest.deviceCrops;
        return rest;
      }),
    }));
    for (const id of touched) persistMeta(get, id);
  },

  reorderItem: (id, toIndex) => {
    set((s) => {
      const from = s.items.findIndex((i) => i.id === id);
      if (from < 0) return s;
      const items = [...s.items];
      const [moved] = items.splice(from, 1);
      items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, moved);
      // The array order becomes the persisted manual order.
      return { items: items.map((i, idx) => ({ ...i, sortIndex: idx })) };
    });
    for (const i of get().items) persistMeta(get, i.id);
  },

  clearDetection: (id) => {
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i;
        const rest = { ...i };
        delete rest.boxes;
        delete rest.scanKeyframes;
        delete rest.scan;
        return rest;
      }),
    }));
    persistMeta(get, id);
  },

  setScan: (id, scan) => {
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i;
        if (!scan) {
          const rest = { ...i };
          delete rest.scan;
          return rest;
        }
        return { ...i, scan };
      }),
    }));
    persistMeta(get, id);
  },

  setScanKeyframes: (id, scanKeyframes) => {
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i;
        if (!scanKeyframes || scanKeyframes.length === 0) {
          const rest = { ...i };
          delete rest.scanKeyframes;
          return rest;
        }
        return { ...i, scanKeyframes };
      }),
    }));
    persistMeta(get, id);
  },

  wipeAll: async () => {
    await idbClearMedia();
    for (const url of [
      ...Object.values(get().objectUrls),
      ...Object.values(get().videoUrls),
    ]) {
      URL.revokeObjectURL(url);
    }
    // A wipe means "fresh visitor" — the next load seeds again.
    try {
      localStorage.removeItem(SEED_KEY);
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // localStorage unavailable; nothing to clear.
    }
    set({ items: [], objectUrls: {}, videoUrls: {}, activeId: null });
  },
}));
