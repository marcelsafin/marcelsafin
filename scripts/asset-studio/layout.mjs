export const HERO_LAYOUTS = Object.freeze({
  desktop: Object.freeze({
    leftTitle: Object.freeze({ x: 64, y: 92, width: 310, height: 82 }),
    rightTitle: Object.freeze({ x: 860, y: 92, width: 276, height: 82 }),
    blurField: Object.freeze({ x: 390, y: 184, width: 420, height: 390 }),
    companion: Object.freeze({ x: 405, y: 184, width: 390, height: 390 }),
    originCard: Object.freeze({
      x: 78,
      y: 620,
      width: 1044,
      height: 100,
    }),
  }),
  mobile: Object.freeze({
    title: Object.freeze({ x: 110, y: 104, width: 680, height: 96 }),
    blurField: Object.freeze({ x: 170, y: 238, width: 560, height: 540 }),
    companion: Object.freeze({ x: 190, y: 245, width: 520, height: 520 }),
    originCard: Object.freeze({
      x: 64,
      y: 858,
      width: 772,
      height: 178,
    }),
  }),
});

export const TIMELINE_LAYOUTS = Object.freeze({
  mobile: Object.freeze({
    title: Object.freeze({
      x: 54,
      y: 30,
      width: 260,
      height: 48,
      baseline: 74,
    }),
    eyebrow: Object.freeze({
      x: 54,
      y: 112,
      width: 792,
      height: 38,
      baseline: 144,
    }),
    firstPanel: Object.freeze({
      x: 54,
      y: 180,
      width: 792,
      height: 214,
    }),
    panelStep: 238,
    frameBottomEdge: 1135,
  }),
});

export function intersects(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function equalizedRightTitleWidth({
  leftX,
  leftWidth,
  companion,
  rightAnchor,
}) {
  const leftGap = companion.x - (leftX + leftWidth);
  return rightAnchor - (companion.x + companion.width + leftGap);
}

export function wrapWords(text, measure, maxWidth) {
  const words = text.split(/\s+/u);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}
