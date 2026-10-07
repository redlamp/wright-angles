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
  idbGetMedia,
  idbPutMedia,
} from "@/lib/idb";
import { stripImageMetadata } from "@/lib/strip-metadata";
import { probeImage, probeVideo } from "@/lib/media-probe";
import {
  drawGenerated,
  generatedItemMeta,
  type GeneratedKind,
} from "@/lib/generated-media";
import {
  addItemBox,
  clearItemDetection,
  compareLibraryOrder,
  hydratedActiveId,
  omitKey,
  removeItem,
  removeItemBox,
  renameItem,
  reorderItems,
  setItemCrop,
  setItemReferenceHeight,
  setItemScan,
  setItemScanKeyframes,
  updateItemBox,
} from "@/lib/media-items";

export { GENERATED_KINDS, type GeneratedKind } from "@/lib/generated-media";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** Re-write one item's metadata beside its stored blob(s), by id — a
 * single-record read/write, not a scan of the whole library. */
function persistItemMeta(item: MediaItem) {
  void idbGetMedia(item.id).then((rec) => {
    if (rec) void idbPutMedia(item.id, { ...rec, meta: item });
  });
}

/** Re-write an item's metadata beside its stored blob(s). */
function persistMeta(get: () => { items: MediaItem[] }, id: string) {
  const item = get().items.find((i) => i.id === id);
  if (item) persistItemMeta(item);
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
  /**
   * Names of files the most recent addFiles() couldn't import (wrong
   * type, or failed to decode) — cleared at the start of the next
   * addFiles() call. UI reads it to show a dismissible note.
   */
  lastImportErrors: string[];
  /** Dismiss the current import-error note. */
  clearImportErrors: () => void;
  /** Load persisted media from IndexedDB. Call once on mount. */
  hydrate: () => Promise<void>;
  /** Imports every decodable file, then queues the whole batch for
   * auto-OCR (stores/ocr-queue-store.ts) once it's done. */
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

export const useMediaStore = create<MediaState>()((set, get) => ({
  items: [],
  objectUrls: {},
  videoUrls: {},
  activeId: null,
  hydrated: false,
  lastImportErrors: [],

  clearImportErrors: () => set({ lastImportErrors: [] }),

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
        // Manual order wins, then insertion order (lib/media-items.ts).
        .sort(compareLibraryOrder);
      // The remembered selection wins over "first item" — a refresh
      // must not hop back to whatever sorts first.
      const remembered = recallActive();
      set((s) => ({
        items,
        objectUrls: urls,
        videoUrls: vids,
        hydrated: true,
        activeId: hydratedActiveId(s.activeId, remembered, items),
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
    const all = Array.from(files);
    const list = all.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (list.length > 0 && navigator.storage?.persist) {
      // Ask the browser not to evict the library under storage pressure.
      // Fire-and-forget: denial just means default (best-effort) durability.
      void navigator.storage.persist();
    }
    // Names of files that didn't make it in this call — wrong type, or
    // failed to decode — surfaced via lastImportErrors instead of
    // disappearing silently.
    const failedNames = all
      .filter((f) => !list.includes(f))
      .map((f) => f.name);
    // Every id that actually made it into the library this call, so OCR
    // can be queued once for the whole batch below — not per file, and
    // not for a file that failed to decode.
    const addedIds: string[] = [];
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
          addedIds.push(meta.id);
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
          addedIds.push(meta.id);
        }
      } catch {
        // Not decodable as an image/video — noted, not silent.
        failedNames.push(file.name);
      }
    }
    set({ lastImportErrors: failedNames });
    if (addedIds.length > 0) {
      // Dynamic import: keeps media-store free of a static dependency on
      // the OCR queue store (which itself imports this module to read
      // items back out — a static cycle both ways). Auto-scan-on-import,
      // no debounce (wiki/research/ocr-cost.md): the batch is already
      // fully imported by the time we get here, and the OCR pipeline's
      // own single-flight lock serializes the scans regardless.
      const { useOcrQueueStore } = await import("./ocr-queue-store");
      useOcrQueueStore.getState().enqueue(addedIds);
    }
  },

  addGenerated: async (kind) => {
    const canvas = drawGenerated(kind);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/png"),
    );
    if (!blob) return;
    // The gradient card carries its pinned OCR scan + boxes.
    const meta = generatedItemMeta(
      kind,
      newId(),
      canvas.width,
      canvas.height,
      Date.now(),
    );
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
    set((s) => ({ items: renameItem(s.items, id, trimmed) }));
    persistMeta(get, id);
  },

  addBox: (mediaId, box) => {
    set((s) => ({ items: addItemBox(s.items, mediaId, box) }));
    persistMeta(get, mediaId);
  },

  updateBox: (mediaId, boxId, patch) => {
    set((s) => ({ items: updateItemBox(s.items, mediaId, boxId, patch) }));
    persistMeta(get, mediaId);
  },

  removeBox: (mediaId, boxId) => {
    set((s) => ({ items: removeItemBox(s.items, mediaId, boxId) }));
    persistMeta(get, mediaId);
  },

  remove: async (id) => {
    await idbDeleteMedia(id);
    set((s) => {
      for (const map of [s.objectUrls, s.videoUrls]) {
        if (map[id]) URL.revokeObjectURL(map[id]);
      }
      return {
        ...removeItem(s.items, s.activeId, id),
        objectUrls: omitKey(s.objectUrls, id),
        videoUrls: omitKey(s.videoUrls, id),
      };
    });
  },

  setActive: (id) => {
    rememberActive(id);
    set({ activeId: id });
  },

  setReferenceHeight: (id, referenceHeight) => {
    set((s) => ({
      items: setItemReferenceHeight(s.items, id, referenceHeight),
    }));
    persistMeta(get, id);
  },

  setCrop: (id, crop) => {
    // A cleared crop drops the key so the item persists crop-free.
    set((s) => ({ items: setItemCrop(s.items, id, crop) }));
    persistMeta(get, id);
  },

  reorderItem: (id, toIndex) => {
    // Captured from the set() updater so the persist pass below reuses
    // the freshly-reordered items directly — one pass over the array
    // it already computed, not an O(n) re-lookup (and idbGetAllMedia
    // whole-library read) per item.
    let reordered: MediaItem[] = [];
    set((s) => {
      // The array order becomes the persisted manual order.
      const next = reorderItems(s.items, id, toIndex);
      if (!next) return s;
      reordered = next;
      return { items: reordered };
    });
    for (const item of reordered) persistItemMeta(item);
  },

  clearDetection: (id) => {
    set((s) => ({ items: clearItemDetection(s.items, id) }));
    persistMeta(get, id);
  },

  setScan: (id, scan) => {
    set((s) => ({ items: setItemScan(s.items, id, scan) }));
    persistMeta(get, id);
  },

  setScanKeyframes: (id, scanKeyframes) => {
    set((s) => ({ items: setItemScanKeyframes(s.items, id, scanKeyframes) }));
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
