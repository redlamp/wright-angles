import { describe, expect, test } from "bun:test";
import {
  imageFilesFromClipboard,
  isTextEntryTarget,
  pastedFileName,
} from "./clipboard-import";

const when = new Date(2026, 9, 13, 9, 5, 7);

describe("pastedFileName", () => {
  test("generic clipboard names get a timestamp", () => {
    expect(pastedFileName("image.png", "image/png", when)).toBe(
      "Pasted 2026-10-13 09.05.07.png",
    );
    expect(pastedFileName("", "image/jpeg", when)).toBe(
      "Pasted 2026-10-13 09.05.07.jpg",
    );
  });
  test("real filenames are kept", () => {
    expect(pastedFileName("hud-mock.png", "image/png", when)).toBe(
      "hud-mock.png",
    );
  });
});

describe("isTextEntryTarget", () => {
  test("typing surfaces", () => {
    expect(isTextEntryTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "textarea" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "DIV", isContentEditable: true })).toBe(
      true,
    );
  });
  test("everything else", () => {
    expect(isTextEntryTarget({ tagName: "BODY" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});

describe("imageFilesFromClipboard", () => {
  const png = new File([new Uint8Array([1])], "image.png", {
    type: "image/png",
  });
  const named = new File([new Uint8Array([1])], "shot.webp", {
    type: "image/webp",
  });
  test("keeps image files only, renaming generic ones", () => {
    const files = imageFilesFromClipboard(
      [
        { kind: "string", type: "text/plain", getAsFile: () => null },
        { kind: "file", type: "application/pdf", getAsFile: () => png },
        { kind: "file", type: "image/png", getAsFile: () => png },
        { kind: "file", type: "image/webp", getAsFile: () => named },
        { kind: "file", type: "image/png", getAsFile: () => null },
      ],
      when,
    );
    expect(files.map((f) => f.name)).toEqual([
      "Pasted 2026-10-13 09.05.07.png",
      "shot.webp",
    ]);
    expect(files[0].type).toBe("image/png");
    expect(files[1]).toBe(named);
  });
});
