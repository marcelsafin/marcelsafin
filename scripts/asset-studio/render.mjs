import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { findChromeExecutable } from "./browser.mjs";

const studioUrl = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "studio.html"),
).href;

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/u.exec(dataUrl);
  if (!match) {
    throw new TypeError("asset studio returned a non-PNG data URL");
  }
  return Buffer.from(match[1], "base64");
}

export async function renderRasterAssets(profile) {
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
    const rendered = await page.evaluate(
      (input) => window.assetStudio.renderAll(input),
      profile,
    );

    return Object.fromEntries(
      Object.entries(rendered).map(([name, dataUrl]) => [
        name,
        decodeDataUrl(dataUrl),
      ]),
    );
  } finally {
    await browser.close();
  }
}
