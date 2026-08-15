/**
 * Neutral color palettes for the 3D scene, one per scene theme. Device key
 * colors are deliberately NOT themed — they must match the 2D views — so
 * only the environment/figure neutrals live here.
 */
export interface ScenePalette {
  bg: string;
  ground: string;
  /** Dashed eye-line and other guide strokes. */
  sight: string;
  figure: string;
  furniture: string;
  /** Cushions/upholstery: a half-step off the furniture frame color. */
  soft: string;
  /** Floor drop-lines and distance labels. */
  label: string;
  /** Handheld chassis slab behind matching device screens. */
  handheldBody: string;
}

export const SCENE_PALETTES: Record<"dark" | "light", ScenePalette> = {
  dark: {
    bg: "#3a3a3a", // ~oklch 0.25 0 0; sits between the dark theme's bg and card
    ground: "#333333",
    sight: "#8f8f8f",
    figure: "#b6b6b6",
    furniture: "#4b4b4b",
    soft: "#464646",
    label: "#9a9a9a",
    handheldBody: "#1f1f1f",
  },
  light: {
    bg: "#d9d9d9",
    ground: "#cfcfcf",
    sight: "#6a6a6a",
    figure: "#8a8a8a",
    // Inverted relationship vs dark: props sit a step BELOW the ground
    // brightness so they still read as solids on the pale floor.
    furniture: "#b0b0b0",
    soft: "#b6b6b6",
    label: "#6f6f6f",
    handheldBody: "#4a4a4a",
  },
};
