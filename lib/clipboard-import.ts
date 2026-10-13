/**
 * Clipboard paste → importable image files. Reads only the structural
 * DataTransferItem shape it's handed (no DOM globals), so the filtering
 * and naming are unit-testable.
 */

/** The slice of DataTransferItem this module reads. */
export interface ClipboardItemLike {
  kind: string;
  type: string;
  getAsFile: () => File | null;
}

/**
 * True when a paste target is somewhere the user is typing (inputs,
 * textareas, selects, contenteditable), so paste-to-import stays out.
 */
export function isTextEntryTarget(
  el: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Library name for a pasted image. Browsers hand clipboard bitmaps over
 * as a generic "image.png"; a timestamped name keeps several pastes
 * apart in the library. Real filenames (a file copied in Finder or
 * Explorer) are kept.
 */
export function pastedFileName(
  original: string,
  type: string,
  when: Date,
): string {
  const generic = !original || /^image\.\w+$/i.test(original);
  if (!generic) return original;
  const ext = (type.split("/")[1] ?? "png").replace("jpeg", "jpg");
  const stamp =
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ` +
    `${pad(when.getHours())}.${pad(when.getMinutes())}.${pad(when.getSeconds())}`;
  return `Pasted ${stamp}.${ext}`;
}

/** The image files on a clipboard, renamed for the library. */
export function imageFilesFromClipboard(
  items: ArrayLike<ClipboardItemLike>,
  when: Date,
): File[] {
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const type = file.type || item.type;
    const name = pastedFileName(file.name, type, when);
    files.push(
      name === file.name
        ? file
        : new File([file], name, { type, lastModified: when.getTime() }),
    );
  }
  return files;
}
