/**
 * Minimal IndexedDB helper for the media library. One DB, one object
 * store; records are { meta, blob } keyed by media id. No external
 * dependency — the API surface we need is four calls.
 */

import type { MediaItem } from "./types";

const DB_NAME = "wright-angles";
const STORE = "media";
const VERSION = 1;

export interface MediaRecord {
  meta: MediaItem;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export const idbPutMedia = (id: string, record: MediaRecord) =>
  tx("readwrite", (s) => s.put(record, id));

export const idbGetMedia = (id: string) =>
  tx<MediaRecord | undefined>("readonly", (s) => s.get(id));

export const idbGetAllMedia = () =>
  tx<MediaRecord[]>("readonly", (s) => s.getAll());

export const idbDeleteMedia = (id: string) =>
  tx("readwrite", (s) => s.delete(id));

export const idbClearMedia = () => tx("readwrite", (s) => s.clear());
