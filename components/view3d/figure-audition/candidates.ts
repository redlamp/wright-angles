/**
 * Replacement humanoids under audition (dev-only, FEATURE_FIGURE_AUDITION).
 * Bundled files live under public/figures/audition/ (credits and license
 * texts in CREDITS.md there). Store-licensed figures that may never be
 * committed live in the gitignored public/figures/local/, described by a
 * manifest.json next to them (see LICENSE-NOTE.md). Everything loads from
 * this origin: the app makes no remote calls (decision-local-only-media).
 */

/** Joint names per side; matched loosely (see findBone in rigged-figure). */
export interface SideBones {
  upperLeg: string;
  lowerLeg: string;
  foot: string;
  upperArm: string;
  foreArm: string;
  hand: string;
}

/**
 * Per-model rig corrections, on top of what the driver measures from the
 * mesh itself (head span, finger and thumb bones, palm direction).
 */
export interface RigTuning {
  /** Eye line as a fraction of the head's vertex span, chin to crown. */
  eyeFraction?: number;
  /** Palm direction in the rest pose when no thumb bone gives it away. */
  palm?: "auto" | "down" | "in" | "back";
  /** Arm reach multiplier: >1 lets short arms meet a desk, <1 keeps elbows bent. */
  reach?: number;
  /** Uniform scale on the hand bones, for packs with stylized oversized hands. */
  handScale?: number;
}

export interface Candidate {
  id: string;
  label: string;
  /** Under public/figures/audition/, or public/figures/ when it starts with "local/". */
  file: string;
  tuning?: RigTuning;
  style: string;
  license: string;
  author: string;
  source: string;
  /** Pelvis joint; documented for adoption, not driven by the audition. */
  hips: string;
  head: string;
  left: SideBones;
  right: SideBones;
}


/**
 * The canonical roles the driver needs, in Mixamo's names. A Mixamo
 * auto-rigged figure (or any rig renamed to this convention) maps with
 * `mixamoSide` and needs nothing else; Mixamo animation clips bind by
 * these names too. Other conventions (3ds Max Biped, MPFB game_engine)
 * map onto the same roles in their manifest or candidate entry.
 */
export const MIXAMO_ROLES = {
  hips: "mixamorig:Hips",
  spine: ["mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2"],
  neck: "mixamorig:Neck",
  head: "mixamorig:Head",
  left: {
    upperLeg: "mixamorig:LeftUpLeg",
    lowerLeg: "mixamorig:LeftLeg",
    foot: "mixamorig:LeftFoot",
    upperArm: "mixamorig:LeftArm",
    foreArm: "mixamorig:LeftForeArm",
    hand: "mixamorig:LeftHand",
  },
} as const;

/** SideBones for a Mixamo-named rig; `prefix` is "" for stripped exports. */
export const mixamoSide = (s: "Left" | "Right", prefix = "mixamorig:"): SideBones => ({
  upperLeg: `${prefix}${s}UpLeg`,
  lowerLeg: `${prefix}${s}Leg`,
  foot: `${prefix}${s}Foot`,
  upperArm: `${prefix}${s}Arm`,
  foreArm: `${prefix}${s}ForeArm`,
  hand: `${prefix}${s}Hand`,
});

/** MPFB2 game_engine rig (UE-style names); see public/figures/audition/mpfb/CREDITS.md. */
const mpfbSide = (s: "l" | "r"): SideBones => ({
  upperLeg: `thigh_${s}`,
  lowerLeg: `calf_${s}`,
  foot: `foot_${s}`,
  upperArm: `upperarm_${s}`,
  foreArm: `lowerarm_${s}`,
  hand: `hand_${s}`,
});
const mpfb = (id: string, label: string, style: string): Candidate => ({
  id: `mpfb-${id}`,
  label: `MPFB ${label}`,
  file: `mpfb/${id}.glb`,
  style,
  license: "CC0-1.0",
  author: "Generated (MakeHuman / MPFB2)",
  source: "https://static.makehumancommunity.org/mpfb.html",
  hips: "pelvis",
  head: "head",
  left: mpfbSide("l"),
  right: mpfbSide("r"),
});
const MPFB: Candidate[] = [
  mpfb("proxy-male-2000", "proxy male (male1591 body)", "Hand-built 1.6k-quad body, casual suit, shoes, hair, eyes"),
  mpfb("dressed-male-2000", "dressed male 2.0k", "Casual suit, shoes, hair, eyes; flat colors baked from textures"),
  mpfb("neutral-2000", "neutral 2.0k", "Human proportions, faceted, 2.0k tris"),
  mpfb("male-2000", "male 2.0k", "Human proportions, faceted, 2.0k tris"),
  mpfb("female-2000", "female 2.0k", "Human proportions, faceted, 2.0k tris"),
  mpfb("neutral-1600", "neutral 1.6k", "Human proportions, faceted, 1.6k tris"),
  mpfb("male-1600", "male 1.6k", "Human proportions, faceted, 1.6k tris"),
  mpfb("female-1600", "female 1.6k", "Human proportions, faceted, 1.6k tris"),
  mpfb("neutral-1000", "neutral 1.0k", "Human proportions, faceted, 1.0k tris"),
  mpfb("neutral-2400", "neutral 2.4k", "Human proportions, faceted, 2.4k tris"),
];

export const CANDIDATES: Candidate[] = [...MPFB];

const base = () => process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const isLocal = (c: Candidate) => c.file.startsWith("local/");

export const candidateUrl = (c: Candidate) =>
  isLocal(c) ? `${base()}/figures/${c.file}` : `${base()}/figures/audition/${c.file}`;

/** Bundled candidates first, then whatever the local manifest added. */
export const findCandidate = (id: string, local: Candidate[] = []) =>
  CANDIDATES.find((c) => c.id === id) ?? local.find((c) => c.id === id);

export const LOCAL_MANIFEST_URL = () => `${base()}/figures/local/manifest.json`;

/**
 * Read the gitignored local manifest. Missing (a fresh clone) is the
 * normal case and yields no candidates; a malformed one is reported.
 */
export async function loadLocalCandidates(): Promise<Candidate[]> {
  try {
    const res = await fetch(LOCAL_MANIFEST_URL(), { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { candidates?: unknown };
    const list = Array.isArray(json.candidates) ? (json.candidates as Candidate[]) : [];
    return list.filter(
      (c) =>
        c && typeof c.id === "string" && typeof c.file === "string" && c.file.startsWith("local/"),
    );
  } catch (e) {
    console.warn("[figure-audition] local manifest unreadable:", e);
    return [];
  }
}
