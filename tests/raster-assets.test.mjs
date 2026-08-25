import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { buildStaticAssets } from "../scripts/render-static-assets.mjs";
import { validatePng } from "../scripts/lib/png.mjs";

const contracts = {
  "companion-light.png": [1600, 1600, "required"],
  "companion-dark.png": [1600, 1600, "required"],
  "hero-light.png": [1200, 760, "forbidden"],
  "hero-dark.png": [1200, 760, "forbidden"],
  "hero-mobile-light.png": [900, 1120, "forbidden"],
  "hero-mobile-dark.png": [900, 1120, "forbidden"],
  "timeline-light.png": [1200, 820, "forbidden"],
  "timeline-dark.png": [1200, 820, "forbidden"],
  "timeline-mobile-light.png": [900, 1160, "forbidden"],
  "timeline-mobile-dark.png": [900, 1160, "forbidden"],
};

test("buildStaticAssets emits ten validated raster assets", async () => {
  const assets = await buildStaticAssets();

  assert.deepEqual(Object.keys(assets), Object.keys(contracts));
  for (const [name, [width, height, transparency]] of Object.entries(
    contracts,
  )) {
    assert.ok(Buffer.isBuffer(assets[name]), name);
    assert.doesNotThrow(() =>
      validatePng(assets[name], { width, height, transparency }),
    );
  }
});

test("buildStaticAssets renders deterministic bytes", async () => {
  const first = await buildStaticAssets();
  const second = await buildStaticAssets();

  assert.deepEqual(first, second);
});

test("obsolete SVG assets and renderer are absent", async () => {
  const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const assetEntries = await fs.readdir(path.join(projectRoot, "assets"));

  assert.equal(assetEntries.some((name) => name.endsWith(".svg")), false);
  await assert.rejects(
    () => fs.lstat(path.join(projectRoot, "scripts/lib/svg.mjs")),
    { code: "ENOENT" },
  );
});

test("hero raster does not paint a false CTA control", async () => {
  const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const studio = await fs.readFile(
    path.join(projectRoot, "scripts/asset-studio/studio.mjs"),
    "utf8",
  );

  assert.doesNotMatch(studio, /Explore the origin story|ORIGIN STORY/);
});

test("hero raster has no low-contrast telemetry copy", async () => {
  const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const studio = await fs.readFile(
    path.join(projectRoot, "scripts/asset-studio/studio.mjs"),
    "utf8",
  );

  assert.doesNotMatch(
    studio,
    /CONTEXT\.LOAD|GRAPH\.CONNECT|TOOLS\.COMPOSE|MEMORY\.REFINE|SYSTEMS\.OBSERVE|ANSWER\.SHIP/,
  );
});

test("hero origin card carries a subtle accent top edge", async () => {
  const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const studio = await fs.readFile(
    path.join(projectRoot, "scripts/asset-studio/studio.mjs"),
    "utf8",
  );

  assert.match(studio, /drawAccentEdge\(context, card/);
});

test("desktop timeline panels are linked by a vertical spine", async () => {
  const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const studio = await fs.readFile(
    path.join(projectRoot, "scripts/asset-studio/studio.mjs"),
    "utf8",
  );

  assert.match(studio, /drawTimelineSpine\(context, width, dark\)/);
});

test("signal geometry uses soft gradient strokes, not flat lines", async () => {
  const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const studio = await fs.readFile(
    path.join(projectRoot, "scripts/asset-studio/studio.mjs"),
    "utf8",
  );

  assert.match(studio, /createLinearGradient/);
  assert.match(studio, /signalGradient/);
});
