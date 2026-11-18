/**
 * Clothes as color regions, not geometry. Every skinned vertex belongs
 * to one region, decided by its dominant bone (plus a hairline test on
 * the head), and an outfit is just a color per region. Swapping outfits
 * recolors 1.6k vertices; no extra assets, no texture.
 */

export type Region = "skin" | "hair" | "top" | "sleeve" | "bottom" | "shin" | "shoe";

export const REGIONS: Region[] = ["skin", "hair", "top", "sleeve", "bottom", "shin", "shoe"];

export interface Outfit {
  id: string;
  label: string;
  skin: string;
  hair: string;
  top: string;
  /** Forearm color: the top for long sleeves, skin for short. */
  sleeve: "long" | "short";
  bottom: string;
  /** Shin color: the bottom for trousers, skin for shorts. */
  shin: "long" | "short";
  shoe: string;
}

export const OUTFITS: Outfit[] = [
  {
    id: "casual",
    label: "Casual (tee, jeans)",
    skin: "#d9a98b",
    hair: "#3b2a1f",
    top: "#4f7fb0",
    sleeve: "short",
    bottom: "#3c3f4a",
    shin: "long",
    shoe: "#e8e4dc",
  },
  {
    id: "office",
    label: "Office (shirt, slacks)",
    skin: "#c48d6a",
    hair: "#2a2420",
    top: "#ececec",
    sleeve: "long",
    bottom: "#2f3a52",
    shin: "long",
    shoe: "#2a2320",
  },
  {
    id: "summer",
    label: "Summer (tee, shorts)",
    skin: "#8a5a3c",
    hair: "#161210",
    top: "#e3c75a",
    sleeve: "short",
    bottom: "#6e8c6a",
    shin: "short",
    shoe: "#f1efe8",
  },
  {
    id: "disco-blazer",
    label: "Disco-ass blazer",
    skin: "#c99a7a",
    hair: "#8a7566",
    top: "#6b5a3a",
    sleeve: "long",
    bottom: "#4d5a3b",
    shin: "long",
    shoe: "#5a3b2a",
  },
  {
    id: "flight-jacket",
    label: "Orange flight jacket",
    skin: "#c9a27f",
    hair: "#1e1b19",
    top: "#d9742b",
    sleeve: "long",
    bottom: "#3a3a3c",
    shin: "long",
    shoe: "#26211e",
  },
];

export const outfitById = (id: string) => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];

/** Resolved color per region for an outfit. */
export function outfitColors(o: Outfit): Record<Region, string> {
  return {
    skin: o.skin,
    hair: o.hair,
    top: o.top,
    sleeve: o.sleeve === "long" ? o.top : o.skin,
    bottom: o.bottom,
    shin: o.shin === "long" ? o.bottom : o.skin,
    shoe: o.shoe,
  };
}

const squash = (n: string) => n.replace(/[\s.:/[\]_-]/g, "").toLowerCase();

/**
 * Region for a bone name, across the rig conventions we meet (MPFB
 * game_engine, UE, Mixamo, Quaternius). "head" is returned for the head
 * so the caller can split it into hair and skin by position.
 */
export function regionForBone(boneName: string): Region | "head" | null {
  const n = squash(boneName);
  if (n.includes("head") || n.includes("neck")) return n.includes("head") ? "head" : "skin";
  if (/(hand|finger|thumb|index|middle|ring|pinky|palm|fist)/.test(n)) return "skin";
  if (/(lowerarm|forearm|elbow)/.test(n)) return "sleeve";
  if (/(upperarm|arm|clavicle|shoulder|spine|chest|stomach|torso)/.test(n)) return "top";
  if (/(foot|ball|toe|ankle)/.test(n)) return "shoe";
  if (/(calf|lowerleg|shin|leg_joint_[lr]_2|knee)/.test(n)) return "shin";
  if (/(thigh|upperleg|hip|pelvis|leg)/.test(n)) return "bottom";
  return null;
}
