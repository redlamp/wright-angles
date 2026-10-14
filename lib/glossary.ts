/**
 * One-line definitions for the jargon the readouts use, shown behind a
 * small "?" next to the term. Written for UI designers, not vision
 * scientists. Pure data.
 */
export const GLOSSARY = {
  arcmin:
    "′ = arc minute, 1/60 of a degree of the viewer's field of view. Text that spans the same arc minutes looks the same size on any screen at any distance. ISO 9241-303: ≥16′ cap height is the minimum, ≥20′ comfortable.",
  ppd: "PPD (px/°) = pixels per degree: how many screen pixels fit in one degree of the viewer's field of view. Around 60 PPD a 20/20 eye stops resolving individual pixels.",
  subRetina:
    "Sub-retina: under ~60 PPD, so a 20/20 viewer can make out individual pixels at this distance — thin strokes and fine detail break up first.",
  minText:
    "Smallest cap height, in pixels of your authoring resolution, that reaches the ISO bands on this device when your image runs fullscreen: comfortable body text ≥20′, absolute minimum ≥16′.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
