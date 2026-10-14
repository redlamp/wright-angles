import { describe, expect, test } from "bun:test";
import { DEVICE_PRESETS } from "./presets";
import { formatDiagonal, presetName, presetSections, presetsInGroup } from "./preset-groups";

describe("presetsInGroup", () => {
  test("all keeps every preset", () => {
    expect(presetsInGroup(DEVICE_PRESETS, "all")).toHaveLength(DEVICE_PRESETS.length);
  });
  test("TV includes projectors; handheld includes phones and tablets", () => {
    const tv = presetsInGroup(DEVICE_PRESETS, "tv").map((p) => p.category);
    expect(new Set(tv)).toEqual(new Set(["tv", "projector"]));
    const held = presetsInGroup(DEVICE_PRESETS, "handheld").map((p) => p.category);
    expect(new Set(held)).toEqual(new Set(["handheld", "phone", "tablet"]));
  });
  test("laptop and monitor groups are non-empty and exact", () => {
    expect(presetsInGroup(DEVICE_PRESETS, "laptop").every((p) => p.category === "laptop")).toBe(true);
    expect(presetsInGroup(DEVICE_PRESETS, "laptop").length).toBeGreaterThan(0);
    expect(presetsInGroup(DEVICE_PRESETS, "monitor").every((p) => p.category === "monitor")).toBe(true);
  });
});

describe("presetSections", () => {
  test("every preset lands in exactly one section, generics last", () => {
    const sections = presetSections(DEVICE_PRESETS);
    const ids = sections.flatMap((s) => s.presets.map((p) => p.presetId));
    expect(ids.sort()).toEqual(DEVICE_PRESETS.map((p) => p.presetId).sort());
    expect(sections.at(-1)?.label).toBe("Generic");
  });
});

describe("preset data", () => {
  test("laptop presets' aspect matches their pixels (square pixels)", () => {
    for (const p of presetsInGroup(DEVICE_PRESETS, "laptop")) {
      expect(p.aspect.w / p.aspect.h).toBeCloseTo(p.resolution.w / p.resolution.h, 6);
    }
  });
});

describe("presetName / formatDiagonal", () => {
  test("strips a leading or trailing size", () => {
    expect(presetName("24″ 1080p Monitor")).toBe("1080p Monitor");
    expect(presetName("MacBook Air 13.6″")).toBe("MacBook Air");
    expect(presetName("120″ Projector")).toBe("Projector");
  });
  test("labels without a size are unchanged", () => {
    expect(presetName("Steam Deck")).toBe("Steam Deck");
    expect(presetName("iPad Pro 13")).toBe("iPad Pro 13");
  });
  test("a label that is only a size stays as-is", () => {
    expect(presetName("27″")).toBe("27″");
  });
  test("diagonals read to one decimal at most", () => {
    expect(formatDiagonal(24)).toBe("24″");
    expect(formatDiagonal(13.6)).toBe("13.6″");
    expect(formatDiagonal(6.2)).toBe("6.2″");
  });
});
