import type { DevicePreset } from "./types";

/**
 * Device presets. Handheld specs and default distances come from Taylor's
 * arc-minute sheet and the prior wright-angles device lists; distances are
 * typical-use defaults, freely adjustable per instance.
 */
export const DEVICE_PRESETS: DevicePreset[] = [
  // Handhelds
  {
    presetId: "switch-lite",
    label: "Switch Lite",
    deviceName: "Nintendo Switch Lite",
    category: "handheld",
    diagonalIn: 5.5,
    distanceCm: 36,
    resolution: { w: 1280, h: 720 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "switch",
    label: "Switch",
    deviceName: "Nintendo Switch",
    category: "handheld",
    diagonalIn: 6.2,
    distanceCm: 36,
    resolution: { w: 1280, h: 720 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "switch-oled",
    label: "Switch OLED",
    deviceName: "Nintendo Switch OLED",
    category: "handheld",
    diagonalIn: 7,
    distanceCm: 36,
    resolution: { w: 1280, h: 720 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "switch-2",
    label: "Switch 2",
    deviceName: "Nintendo Switch 2",
    category: "handheld",
    diagonalIn: 7.9,
    distanceCm: 40,
    resolution: { w: 1920, h: 1080 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "steam-deck",
    label: "Steam Deck",
    deviceName: "Valve Steam Deck",
    category: "handheld",
    diagonalIn: 7,
    distanceCm: 50,
    resolution: { w: 1280, h: 800 },
    aspect: { w: 16, h: 10 },
  },
  {
    presetId: "steam-deck-oled",
    label: "Steam Deck OLED",
    deviceName: "Valve Steam Deck OLED",
    category: "handheld",
    diagonalIn: 7.4,
    distanceCm: 50,
    resolution: { w: 1280, h: 800 },
    aspect: { w: 16, h: 10 },
  },

  // Phones
  {
    presetId: "iphone-16-pro",
    label: "iPhone 16 Pro",
    deviceName: "Apple iPhone 16 Pro",
    category: "phone",
    diagonalIn: 6.3,
    distanceCm: 35,
    resolution: { w: 2622, h: 1206 },
    aspect: { w: 2622, h: 1206 },
  },
  {
    presetId: "galaxy-s24",
    label: "Galaxy S24",
    deviceName: "Samsung Galaxy S24",
    category: "phone",
    diagonalIn: 6.2,
    distanceCm: 35,
    resolution: { w: 2340, h: 1080 },
    aspect: { w: 2340, h: 1080 },
  },

  // Tablets
  {
    presetId: "ipad-pro-13",
    label: "iPad Pro 13",
    deviceName: "Apple iPad Pro 13″ (M4)",
    category: "tablet",
    diagonalIn: 13,
    distanceCm: 45,
    resolution: { w: 2752, h: 2064 },
    aspect: { w: 4, h: 3 },
  },

  // Monitors
  {
    presetId: "monitor-24-1080",
    label: "24″ 1080p Monitor",
    category: "monitor",
    diagonalIn: 24,
    distanceCm: 70,
    resolution: { w: 1920, h: 1080 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "monitor-27-1440",
    label: "27″ 1440p Monitor",
    category: "monitor",
    diagonalIn: 27,
    distanceCm: 70,
    resolution: { w: 2560, h: 1440 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "monitor-27-4k",
    label: "27″ 4K Monitor",
    category: "monitor",
    diagonalIn: 27,
    distanceCm: 70,
    resolution: { w: 3840, h: 2160 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "monitor-32-4k",
    label: "32″ 4K Monitor",
    category: "monitor",
    diagonalIn: 32,
    distanceCm: 70,
    resolution: { w: 3840, h: 2160 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "monitor-34-uw",
    label: "34″ Ultrawide",
    category: "monitor",
    diagonalIn: 34,
    distanceCm: 70,
    resolution: { w: 3440, h: 1440 },
    aspect: { w: 21, h: 9 },
  },
  {
    presetId: "monitor-49-suw",
    label: "49″ Super Ultrawide",
    deviceName: "Samsung Odyssey G9",
    category: "monitor",
    diagonalIn: 49,
    distanceCm: 70,
    resolution: { w: 5120, h: 1440 },
    aspect: { w: 32, h: 9 },
    curvatureR: 1000,
  },

  // TVs
  {
    presetId: "tv-32-720",
    label: "32″ 720p TV",
    category: "tv",
    diagonalIn: 32,
    distanceCm: 200,
    resolution: { w: 1280, h: 720 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "tv-40-1080",
    label: "40″ 1080p TV",
    category: "tv",
    diagonalIn: 40,
    distanceCm: 200,
    resolution: { w: 1920, h: 1080 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "tv-49-4k",
    label: "49″ 4K TV",
    category: "tv",
    diagonalIn: 49,
    distanceCm: 200,
    resolution: { w: 3840, h: 2160 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "tv-55-4k",
    label: "55″ 4K TV",
    category: "tv",
    diagonalIn: 55,
    distanceCm: 300,
    resolution: { w: 3840, h: 2160 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "tv-65-4k",
    label: "65″ 4K TV",
    category: "tv",
    diagonalIn: 65,
    distanceCm: 300,
    resolution: { w: 3840, h: 2160 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "projector-120",
    label: "120″ Projector",
    category: "projector",
    diagonalIn: 120,
    distanceCm: 300,
    resolution: { w: 3840, h: 2160 },
    aspect: { w: 16, h: 9 },
  },

  // Generics — starting points for custom values
  {
    presetId: "generic-monitor",
    label: "Monitor",
    category: "custom",
    diagonalIn: 27,
    distanceCm: 70,
    resolution: { w: 2560, h: 1440 },
    aspect: { w: 16, h: 9 },
  },
  {
    presetId: "generic-tv",
    label: "TV",
    category: "custom",
    diagonalIn: 55,
    distanceCm: 250,
    resolution: { w: 3840, h: 2160 },
    aspect: { w: 16, h: 9 },
  },
];

/**
 * Full-device body dimensions for known handhelds, keyed by `deviceName`
 * (devices are instances, so product identity is the stable key). Used by
 * the 3D view to draw the chassis around the screen so display size vs
 * device size reads. Manufacturer spec sheets, cm.
 */
export const HANDHELD_BODIES: Record<
  string,
  { bodyWCm: number; bodyHCm: number; depthCm: number }
> = {
  "Nintendo Switch": { bodyWCm: 23.9, bodyHCm: 10.2, depthCm: 1.4 },
  "Nintendo Switch OLED": { bodyWCm: 24.2, bodyHCm: 10.2, depthCm: 1.4 },
  "Nintendo Switch Lite": { bodyWCm: 20.8, bodyHCm: 9.1, depthCm: 1.4 },
  "Nintendo Switch 2": { bodyWCm: 27.2, bodyHCm: 11.6, depthCm: 1.4 },
  "Valve Steam Deck": { bodyWCm: 29.8, bodyHCm: 11.7, depthCm: 4.9 },
  "Valve Steam Deck OLED": { bodyWCm: 29.8, bodyHCm: 11.7, depthCm: 4.9 },
};

/**
 * Key-color cycle auto-assigned to new devices (user-adjustable). Saturated
 * against the neutral chrome; sequenced for adjacent contrast.
 */
export const DEVICE_COLORS = [
  "#4f8ef7", // blue
  "#e5484d", // red
  "#46a758", // green
  "#f5a524", // amber
  "#8e4ef7", // violet
  "#12a594", // teal
  "#e93d82", // pink
  "#f76b15", // orange
] as const;

export const COMMON_ASPECTS: { label: string; w: number; h: number }[] = [
  { label: "16:9", w: 16, h: 9 },
  { label: "16:10", w: 16, h: 10 },
  { label: "21:9", w: 21, h: 9 },
  { label: "32:9", w: 32, h: 9 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:2", w: 3, h: 2 },
  { label: "5:4", w: 5, h: 4 },
  { label: "19.5:9", w: 39, h: 18 },
];

/** Common resolutions per aspect, for the dimensions dropdown. */
export const COMMON_RESOLUTIONS: Record<string, { w: number; h: number }[]> = {
  "16:9": [
    { w: 1280, h: 720 },
    { w: 1920, h: 1080 },
    { w: 2560, h: 1440 },
    { w: 3840, h: 2160 },
  ],
  "16:10": [
    { w: 1280, h: 800 },
    { w: 1920, h: 1200 },
    { w: 2560, h: 1600 },
  ],
  "21:9": [
    { w: 2560, h: 1080 },
    { w: 3440, h: 1440 },
    { w: 5120, h: 2160 },
  ],
  "32:9": [
    { w: 3840, h: 1080 },
    { w: 5120, h: 1440 },
  ],
  "4:3": [
    { w: 1024, h: 768 },
    { w: 1600, h: 1200 },
    { w: 2048, h: 1536 },
  ],
  "3:2": [
    { w: 2160, h: 1440 },
    { w: 2256, h: 1504 },
    { w: 2880, h: 1920 },
  ],
  "5:4": [{ w: 1280, h: 1024 }],
  "19.5:9": [
    { w: 2340, h: 1080 },
    { w: 2622, h: 1206 },
    { w: 2796, h: 1290 },
  ],
};
