"use client";

import { create } from "zustand";
import type { MediaItem } from "@/lib/types";
import {
  idbClearMedia,
  idbDeleteMedia,
  idbGetAllMedia,
  idbPutMedia,
} from "@/lib/idb";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** Intrinsic pixel size of an image blob. */
function probeImage(blob: Blob): Promise<{ width: number; height: number }> {
  return createImageBitmap(blob).then((bmp) => {
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  });
}

interface MediaState {
  items: MediaItem[];
  /** Runtime-only object URLs, keyed by media id. Revoked on remove. */
  objectUrls: Record<string, string>;
  activeId: string | null;
  hydrated: boolean;
  /** Load persisted media from IndexedDB. Call once on mount. */
  hydrate: () => Promise<void>;
  addFiles: (files: FileList | File[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  setReferenceHeight: (id: string, referenceHeight: number) => void;
  wipeAll: () => Promise<void>;
}

export const useMediaStore = create<MediaState>()((set, get) => ({
  items: [],
  objectUrls: {},
  activeId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const records = await idbGetAllMedia();
      const urls: Record<string, string> = {};
      const items = records
        .map((r) => {
          urls[r.meta.id] = URL.createObjectURL(r.blob);
          return r.meta;
        })
        .sort((a, b) => a.addedAt - b.addedAt);
      set((s) => ({
        items,
        objectUrls: urls,
        hydrated: true,
        activeId: s.activeId ?? items[0]?.id ?? null,
      }));
    } catch {
      // IndexedDB unavailable (private browsing edge cases) — run
      // session-only with an empty library.
      set({ hydrated: true });
    }
  },

  addFiles: async (files) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length > 0 && navigator.storage?.persist) {
      // Ask the browser not to evict the library under storage pressure.
      // Fire-and-forget: denial just means default (best-effort) durability.
      void navigator.storage.persist();
    }
    for (const file of list) {
      try {
        const { width, height } = await probeImage(file);
        const meta: MediaItem = {
          id: newId(),
          name: file.name,
          type: file.type,
          width,
          height,
          referenceHeight: height,
          addedAt: Date.now(),
        };
        await idbPutMedia(meta.id, { meta, blob: file });
        const url = URL.createObjectURL(file);
        set((s) => ({
          items: [...s.items, meta],
          objectUrls: { ...s.objectUrls, [meta.id]: url },
          activeId: s.activeId ?? meta.id,
        }));
      } catch {
        // Not decodable as an image — skip silently.
      }
    }
  },

  remove: async (id) => {
    await idbDeleteMedia(id);
    set((s) => {
      const url = s.objectUrls[id];
      if (url) URL.revokeObjectURL(url);
      const objectUrls = { ...s.objectUrls };
      delete objectUrls[id];
      const items = s.items.filter((i) => i.id !== id);
      return {
        items,
        objectUrls,
        activeId:
          s.activeId === id ? (items[0]?.id ?? null) : s.activeId,
      };
    });
  },

  setActive: (id) => set({ activeId: id }),

  setReferenceHeight: (id, referenceHeight) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, referenceHeight } : i)),
    }));
    // Persist the changed metadata alongside its blob.
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    void idbGetAllMedia().then((records) => {
      const rec = records.find((r) => r.meta.id === id);
      if (rec) void idbPutMedia(id, { meta: item, blob: rec.blob });
    });
  },

  wipeAll: async () => {
    await idbClearMedia();
    for (const url of Object.values(get().objectUrls)) {
      URL.revokeObjectURL(url);
    }
    set({ items: [], objectUrls: {}, activeId: null });
  },
}));
