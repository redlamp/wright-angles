/**
 * Build-time feature flags — a place to park features that exist in
 * the code but shouldn't ship yet. Flip to true to revisit.
 */

/**
 * Handheld chassis models around the 3D screens (Switch/Deck bodies).
 * Parked 2026-08-19 (Taylor): the screens alone read cleaner for now.
 */
export const FEATURE_3D_DEVICE_BODY = false;

/**
 * Pin a device's details out of the Device Manager into a floating
 * window. Parked 2026-08-19 (Taylor): revisit alongside the flagged
 * features review.
 */
export const FEATURE_PINNED_DEVICES = false;

/**
 * Collapse toggle on the workbench column divider. Parked 2026-08-19
 * (Taylor); the drag divider itself stays.
 */
export const FEATURE_COLLAPSE_FIRST_COLUMN = false;

/**
 * Replacement-humanoid audition: a picker over the 3D scene that swaps
 * the capsule figure for a bundled rigged glTF candidate. Dev server
 * only (2026-10-14); never ships until Taylor picks a figure.
 */
export const FEATURE_FIGURE_AUDITION = process.env.NODE_ENV === "development";
