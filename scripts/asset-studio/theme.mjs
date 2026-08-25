export const RASTER_THEMES = Object.freeze({
  dark: Object.freeze({
    background: "#0d1015",
    surface: "#111827",
    foreground: "#f1f5f9",
    muted: "#aeb9c8",
    border: "#27303b",
  }),
  light: Object.freeze({
    background: "#f4f7fb",
    surface: "#f1f5f9",
    foreground: "#111827",
    muted: "#27303b",
    border: "#cbd5e1",
  }),
});

export const RASTER_ACCENTS = Object.freeze({
  blue: "#5f97ff",
  blueViolet: "#6f7dff",
  violet: "#8b64f6",
  pink: "#d466ab",
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
