import { describe, expect, test } from "bun:test";
import { GENERATED_KINDS, generatedItemMeta } from "./generated-media";
import { GRADIENT_SEED_SCAN } from "./gradient-seed-scan";

describe("GENERATED_KINDS", () => {
  test("lists each kind once", () => {
    const kinds = GENERATED_KINDS.map((k) => k.kind);
    expect(kinds).toEqual(["smpte-bars", "grid", "gradient", "solid"]);
  });
});

describe("generatedItemMeta", () => {
  test("builds an image item named after the kind's label", () => {
    expect(generatedItemMeta("grid", "id1", 1920, 1080, 42)).toEqual({
      id: "id1",
      name: "Alignment grid (generated)",
      type: "image/png",
      kind: "image",
      width: 1920,
      height: 1080,
      referenceHeight: 1080,
      addedAt: 42,
    });
  });

  test("non-gradient cards carry no scan or boxes", () => {
    for (const kind of ["smpte-bars", "grid", "solid"] as const) {
      const meta = generatedItemMeta(kind, "x", 1920, 1080, 0);
      expect("scan" in meta).toBe(false);
      expect("boxes" in meta).toBe(false);
    }
  });

  test("reference height follows the canvas height", () => {
    const meta = generatedItemMeta("solid", "x", 640, 480, 0);
    expect(meta.referenceHeight).toBe(480);
    expect(meta.name).toBe("Solid gray (generated)");
  });

  test("gradient card carries the pinned scan and one labeled box per line", () => {
    const meta = generatedItemMeta("gradient", "g", 1920, 1080, 0);
    expect(meta.name).toBe("Gradient card (generated)");
    expect(meta.scan).toBe(GRADIENT_SEED_SCAN);
    expect(meta.boxes!.length).toBe(GRADIENT_SEED_SCAN.lines.length);
    GRADIENT_SEED_SCAN.lines.forEach((line, idx) => {
      expect(meta.boxes![idx]).toEqual({
        id: line.id,
        label: line.text,
        ...line.box,
      });
    });
  });
});
