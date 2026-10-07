/**
 * DOM probes for imported media: intrinsic size of an image blob, and
 * video metadata + a poster frame. Browser-only (createImageBitmap,
 * <video>, <canvas>); used by stores/media-store.ts on import.
 */

/** Intrinsic pixel size of an image blob. */
export function probeImage(blob: Blob): Promise<{ width: number; height: number }> {
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
export function probeVideo(blob: Blob): Promise<{
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
