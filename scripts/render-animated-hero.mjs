import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { findChromeExecutable } from "./asset-studio/browser.mjs";

const FRAMES = 84;
const FRAME_DURATION_MS = 83; // ~7 s loop, matches web3d motion frequencies

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const studioUrl = pathToFileURL(
  path.join(projectRoot, "scripts", "asset-studio", "studio.html"),
).href;

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/u.exec(dataUrl);
  if (!match) {
    throw new TypeError("asset studio returned a non-PNG data URL");
  }
  return Buffer.from(match[1], "base64");
}

function assembleWebp(frameDir, frameCount, outputPath) {
  const frameArgs = [];
  for (let index = 0; index < frameCount; index += 1) {
    frameArgs.push(
      "-d",
      String(FRAME_DURATION_MS),
      path.join(frameDir, `frame-${String(index).padStart(3, "0")}.png`),
    );
  }
  const result = spawnSync(
    "img2webp",
    ["-loop", "0", "-mixed", "-q", "70", ...frameArgs, "-o", outputPath],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (result.error?.code === "ENOENT") {
    throw new Error("img2webp not found — install libwebp (brew install webp)");
  }
  if (result.status !== 0) {
    throw new Error(`img2webp failed: ${result.stderr}`);
  }
}

async function renderTheme(page, dark) {
  const frames = await page.evaluate(
    (input) => window.assetStudio.renderHeroAnimation(input),
    { dark, frames: FRAMES },
  );
  if (frames.length !== FRAMES) {
    throw new Error(`expected ${FRAMES} frames, got ${frames.length}`);
  }

  const themeName = dark ? "dark" : "light";
  const frameDir = await fs.mkdtemp(
    path.join(projectRoot, `.hero-animation-tmp-${themeName}-`),
  );
  try {
    await Promise.all(
      frames.map((dataUrl, index) =>
        fs.writeFile(
          path.join(frameDir, `frame-${String(index).padStart(3, "0")}.png`),
          decodeDataUrl(dataUrl),
        ),
      ),
    );
    const outputPath = path.join(
      projectRoot,
      "assets",
      `hero-${themeName}.webp`,
    );
    assembleWebp(frameDir, FRAMES, outputPath);
    const { size } = await fs.stat(outputPath);
    return { outputPath, size };
  } finally {
    await fs.rm(frameDir, { recursive: true, force: true });
  }
}

async function main() {
  const executablePath = await findChromeExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--allow-file-access-from-files",
      "--disable-gpu-sandbox",
      "--use-angle=swiftshader",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.goto(studioUrl);
    await page.waitForFunction(() => Boolean(window.assetStudio));

    for (const dark of [true, false]) {
      const { outputPath, size } = await renderTheme(page, dark);
      console.log(
        `${path.relative(projectRoot, outputPath)}: ${(size / 1024).toFixed(0)} KiB`,
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
