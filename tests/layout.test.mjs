import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_LAYOUTS,
  TIMELINE_LAYOUTS,
  equalizedRightTitleWidth,
  intersects,
  wrapWords,
} from "../scripts/asset-studio/layout.mjs";
import {
  ASSET_TYPOGRAPHY,
  RASTER_THEMES,
  contrastRatio,
} from "../scripts/asset-studio/theme.mjs";

test("desktop hero keeps identity, companion, blur, and CTA in separate zones", () => {
  const { leftTitle, rightTitle, blurField, companion, originCard } =
    HERO_LAYOUTS.desktop;

  assert.equal(intersects(leftTitle, blurField), false);
  assert.equal(intersects(rightTitle, blurField), false);
  assert.equal(intersects(leftTitle, companion), false);
  assert.equal(intersects(rightTitle, companion), false);
  assert.equal(intersects(companion, originCard), false);
  assert.ok(originCard.y - (companion.y + companion.height) >= 40);
});

test("mobile hero keeps title, companion, and CTA vertically separated", () => {
  const { title, companion, originCard } = HERO_LAYOUTS.mobile;

  assert.equal(intersects(title, companion), false);
  assert.equal(intersects(companion, originCard), false);
  assert.ok(originCard.y - (companion.y + companion.height) >= 50);
});

test("light raster metadata meets AAA contrast", () => {
  assert.ok(
    contrastRatio(
      RASTER_THEMES.light.muted,
      RASTER_THEMES.light.background,
    ) >= 7,
  );
});

test("mobile timeline raster type remains readable at GitHub width", () => {
  const scale = 358 / 900;

  assert.ok(ASSET_TYPOGRAPHY.timeline.mobile.label * scale >= 12);
  assert.ok(ASSET_TYPOGRAPHY.timeline.mobile.title * scale >= 16);
  assert.ok(ASSET_TYPOGRAPHY.timeline.mobile.eyebrow * scale >= 12);
});

test("mobile hero raster metadata remains readable at GitHub width", () => {
  const scale = 358 / 900;

  assert.ok(ASSET_TYPOGRAPHY.hero.mobile.attribution * scale >= 12);
  assert.ok(ASSET_TYPOGRAPHY.hero.mobile.railLabel * scale >= 12);
});

test("mobile timeline header labels are stacked with breathing room", () => {
  const { title, eyebrow, firstPanel } = TIMELINE_LAYOUTS.mobile;

  assert.equal(intersects(title, eyebrow), false);
  assert.equal(intersects(eyebrow, firstPanel), false);
  assert.ok(eyebrow.y - (title.y + title.height) >= 30);
});

test("mobile timeline preserves panel rhythm and bottom frame clearance", () => {
  const { firstPanel, panelStep, frameBottomEdge } = TIMELINE_LAYOUTS.mobile;
  const panelGap = panelStep - firstPanel.height;
  const lastPanelBottom = firstPanel.y + panelStep * 3 + firstPanel.height;

  assert.ok(panelGap >= 24);
  assert.ok(frameBottomEdge - lastPanelBottom >= 24);
});

test("desktop split title can equalize inner companion clearance", () => {
  const companion = HERO_LAYOUTS.desktop.companion;
  const leftX = 64;
  const leftWidth = 316;
  const rightAnchor = 1136;
  const rightWidth = equalizedRightTitleWidth({
    leftX,
    leftWidth,
    companion,
    rightAnchor,
  });
  const leftGap = companion.x - (leftX + leftWidth);
  const rightGap = rightAnchor - rightWidth - (companion.x + companion.width);

  assert.equal(rightGap, leftGap);
});

test("timeline wrapping never drops heading words", () => {
  const heading = "I am following the systems underneath the tools.";
  const lines = wrapWords(heading, (text) => text.length * 10, 180);

  assert.equal(lines.join(" "), heading);
  assert.ok(lines.length <= 3);
});
