export const RASTER_THEMES = Object.freeze({
  dark: Object.freeze({
    background: "#050505",
    surface: "#0f0f0f",
    foreground: "#fafafa",
    muted: "#c2c2c2",
    border: "#424242",
    accent: "#c084fc",
  }),
  light: Object.freeze({
    background: "#fafafa",
    surface: "#ffffff",
    foreground: "#0a0a0a",
    muted: "#4a4a4a",
    border: "#d4d4d4",
    accent: "#7c3aed",
  }),
});

export const RASTER_ACCENTS = Object.freeze({
  violet: "#c084fc",
  lilac: "#a78bfa",
  violetDeep: "#8b5cf6",
  violetInk: "#7c3aed",
});

export const ASSET_TYPOGRAPHY = Object.freeze({
  hero: Object.freeze({
    desktop: Object.freeze({ attribution: 17, railLabel: 14 }),
    mobile: Object.freeze({ attribution: 32, railLabel: 32 }),
  }),
  timeline: Object.freeze({
    desktop: Object.freeze({ eyebrow: 14, label: 16, title: 29 }),
    mobile: Object.freeze({ eyebrow: 32, label: 32, title: 42 }),
  }),
});

function channel(hexPair) {
  const value = Number.parseInt(hexPair, 16) / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const normalized = hex.replace(/^#/u, "");
  const red = channel(normalized.slice(0, 2));
  const green = channel(normalized.slice(2, 4));
  const blue = channel(normalized.slice(4, 6));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first, second) {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}
