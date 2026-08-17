/**
 * Import-time metadata stripping (browser-only; not part of the pure
 * math libs).
 *
 * Wright Angles never uploads anything, but the bytes stored in
 * IndexedDB can still leave the machine later — a screenshot shared
 * from disk, an export, a bug report. Re-encoding static images
 * through a canvas drops EXIF/XMP/GPS blocks (camera serials, location
 * tags) so the stored copy can't leak them.
 *
 * Only static formats are re-encoded: JPEG, PNG, WebP. GIFs pass
 * through untouched (re-encoding would flatten the animation to one
 * frame), as do videos and anything else. Import must never break on
 * this path — every failure falls back to the original bytes.
 */

const STRIPPABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Re-encode a static image to shed metadata. Returns a new Blob of the
 * SAME MIME type, or the original blob unchanged if the type isn't
 * strippable or re-encoding fails for any reason.
 */
export async function stripImageMetadata(file: Blob): Promise<Blob> {
  if (!STRIPPABLE.has(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bmp, 0, 0);
      const quality = file.type === "image/png" ? undefined : 0.92;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, file.type, quality),
      );
      // No blob, or the encoder silently fell back to another format
      // (e.g. a browser that can't encode WebP): keep the original so
      // the stored type stays truthful.
      if (!blob || blob.type !== file.type) return file;
      return blob;
    } finally {
      bmp.close();
    }
  } catch {
    return file;
  }
}
