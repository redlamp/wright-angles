import { describe, expect, test } from "bun:test";
import { aspectLabel } from "./aspect-label";

describe("aspectLabel (square pixels)", () => {
  test("exact common ratios", () => {
    expect(aspectLabel({ w: 2560, h: 1440 })).toBe("16:9");
    expect(aspectLabel({ w: 2560, h: 1600 })).toBe("16:10");
    expect(aspectLabel({ w: 1024, h: 768 })).toBe("4:3");
    expect(aspectLabel({ w: 1280, h: 1024 })).toBe("5:4");
    expect(aspectLabel({ w: 3000, h: 2000 })).toBe("3:2");
    expect(aspectLabel({ w: 5120, h: 1440 })).toBe("32:9");
  });
  test("awkward reductions read as the nearest common ratio", () => {
    expect(aspectLabel({ w: 1366, h: 768 })).toBe("≈16:9");
    expect(aspectLabel({ w: 3440, h: 1440 })).toBe("≈21:9");
    expect(aspectLabel({ w: 2560, h: 1080 })).toBe("≈21:9");
  });
  test("anything else reads as a decimal", () => {
    expect(aspectLabel({ w: 2731, h: 1000 })).toBe("2.73:1");
  });
  test("portrait keeps its orientation", () => {
    expect(aspectLabel({ w: 1080, h: 1920 })).toBe("9:16");
    expect(aspectLabel({ w: 768, h: 1366 })).toBe("≈9:16");
  });
  test("unusable input gives an empty label", () => {
    expect(aspectLabel({ w: 0, h: 1080 })).toBe("");
  });
});
