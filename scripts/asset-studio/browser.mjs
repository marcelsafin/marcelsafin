import fs from "node:fs/promises";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
].filter(Boolean);

export async function findChromeExecutable() {
  for (const candidate of CANDIDATES) {
    try {
      const info = await fs.stat(candidate);
      if (info.isFile()) {
        return candidate;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error("Chrome executable not found; set CHROME_PATH");
}
