import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProfileConfig } from "./lib/profile-config.mjs";
import { renderProfileReadme } from "./lib/readme.mjs";
import { buildStaticAssets } from "./render-static-assets.mjs";
import { writeFilesAtomically } from "./lib/atomic-files.mjs";
import {
  cleanupExitCode,
  formatCleanupFailures,
} from "./lib/cli-result.mjs";

const moduleRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export async function generateProfile({
  root = moduleRoot,
  fsImpl = fs,
  onPhase,
} = {}) {
  const projectRoot = path.resolve(root);
  const configPath = path.join(projectRoot, "data", "profile.json");
  const readmePath = path.join(projectRoot, "README.md");
  const assetsPath = path.join(projectRoot, "assets");

  const config = validateProfileConfig(
    JSON.parse(await fsImpl.readFile(configPath, "utf8")),
  );
  const readme = renderProfileReadme(config);
  const assets = await buildStaticAssets(config);
  const files = {
    [readmePath]: readme,
    ...Object.fromEntries(
      Object.entries(assets).map(([name, content]) => [
        path.join(assetsPath, name),
        content,
      ]),
    ),
  };

  let currentReadme = null;
  try {
    currentReadme = await fsImpl.readFile(readmePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  return writeFilesAtomically(files, {
    fsImpl,
    onPhase,
    expectedContents: {
      [readmePath]: currentReadme,
    },
  });
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await generateProfile();
  if (result.cleanupFailures.length > 0) {
    console.error(formatCleanupFailures(result));
    process.exitCode = cleanupExitCode(result);
  } else if (result.changed) {
    console.log(`Updated ${result.files.length} generated file(s).`);
  } else {
    console.log("Generated profile is already current.");
  }
}
