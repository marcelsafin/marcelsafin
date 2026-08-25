import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProfileConfig } from "./lib/profile-config.mjs";
import { renderRasterAssets } from "./asset-studio/render.mjs";
import { writeFilesAtomically } from "./lib/atomic-files.mjs";
import { validatePng } from "./lib/png.mjs";
import {
  cleanupExitCode,
  formatCleanupFailures,
} from "./lib/cli-result.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const profilePath = path.join(projectRoot, "data", "profile.json");
const defaultAssetsPath = path.join(projectRoot, "assets");
const config = validateProfileConfig(
  JSON.parse(await fs.readFile(profilePath, "utf8")),
);

const ASSET_CONTRACTS = Object.freeze({
  "companion-light.png": Object.freeze({
    width: 1600,
    height: 1600,
    transparency: "required",
  }),
  "companion-dark.png": Object.freeze({
    width: 1600,
    height: 1600,
    transparency: "required",
  }),
  "hero-light.png": Object.freeze({
    width: 1200,
    height: 760,
    transparency: "forbidden",
  }),
  "hero-dark.png": Object.freeze({
    width: 1200,
    height: 760,
    transparency: "forbidden",
  }),
  "hero-mobile-light.png": Object.freeze({
    width: 900,
    height: 1120,
    transparency: "forbidden",
  }),
  "hero-mobile-dark.png": Object.freeze({
    width: 900,
    height: 1120,
    transparency: "forbidden",
  }),
  "timeline-light.png": Object.freeze({
    width: 1200,
    height: 820,
    transparency: "forbidden",
  }),
  "timeline-dark.png": Object.freeze({
    width: 1200,
    height: 820,
    transparency: "forbidden",
  }),
  "timeline-mobile-light.png": Object.freeze({
    width: 900,
    height: 1160,
    transparency: "forbidden",
  }),
  "timeline-mobile-dark.png": Object.freeze({
    width: 900,
    height: 1160,
    transparency: "forbidden",
  }),
});

export async function buildStaticAssets(profile = config) {
  return renderRasterAssets(profile);
}

function normalizeWriterOptions(options = {}) {
  return {
    root: path.resolve(options.root ?? options.assetsPath ?? defaultAssetsPath),
    fsImpl: options.fsImpl ?? options.fsApi ?? fs,
    onPhase: options.onPhase,
  };
}

function validateAssets(assets) {
  if (assets === null || typeof assets !== "object" || Array.isArray(assets)) {
    throw new TypeError("assets must be a non-empty plain object");
  }

  const entries = Object.entries(assets);
  if (entries.length === 0) {
    throw new TypeError("assets must be a non-empty plain object");
  }

  for (const [name, content] of entries) {
    if (!(name in ASSET_CONTRACTS) || path.basename(name) !== name) {
      throw new TypeError(`asset name "${name}" is not in the PNG contract`);
    }
    if (!Buffer.isBuffer(content)) {
      throw new TypeError(`assets["${name}"] must be a Buffer`);
    }
    try {
      validatePng(content, ASSET_CONTRACTS[name]);
    } catch (error) {
      throw new TypeError(
        `asset "${name}" contains invalid PNG: ${error.message}`,
        { cause: error },
      );
    }
  }

  if (entries.length !== Object.keys(ASSET_CONTRACTS).length) {
    throw new TypeError("assets must contain the exact ten-file PNG contract");
  }

  return entries;
}

async function ensureRealDirectory(fsImpl, root) {
  const components = [];
  const parsedRoot = path.parse(root);
  let component = parsedRoot.root;
  components.push(component);

  for (const part of root.slice(parsedRoot.root.length).split(path.sep)) {
    if (part.length === 0) {
      continue;
    }
    component = path.join(component, part);
    components.push(component);
  }

  let firstMissing = components.length;
  for (let index = 0; index < components.length; index += 1) {
    try {
      const info = await fsImpl.lstat(components[index]);
      if (info.isSymbolicLink()) {
        throw new TypeError(
          `asset root "${root}" path component "${components[index]}" must be a real directory, not a symlink`,
        );
      }
      if (!info.isDirectory()) {
        throw new TypeError(
          `asset root "${root}" path component "${components[index]}" must be a real directory`,
        );
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      firstMissing = index;
      break;
    }
  }

  if (firstMissing === components.length) {
    return;
  }

  for (let index = firstMissing; index < components.length; index += 1) {
    try {
      await fsImpl.mkdir(components[index]);
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
    }
  }

  for (const componentPath of components) {
    let info;
    try {
      info = await fsImpl.lstat(componentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new TypeError(
          `asset root "${root}" path component "${componentPath}" must be an existing real directory`,
        );
      }
      throw error;
    }
    if (info.isSymbolicLink()) {
      throw new TypeError(
        `asset root "${root}" path component "${componentPath}" must be a real directory, not a symlink`,
      );
    }
    if (!info.isDirectory()) {
      throw new TypeError(
        `asset root "${root}" path component "${componentPath}" must be a real directory`,
      );
    }
  }
}

export async function writeStaticAssetsAtomically(assets, options = {}) {
  const { root, fsImpl, onPhase } = normalizeWriterOptions(options);
  const entries = validateAssets(assets);

  await ensureRealDirectory(fsImpl, root);

  const files = Object.fromEntries(
    entries.map(([name, content]) => [
      path.join(root, name),
      content,
    ]),
  );
  const result = await writeFilesAtomically(files, { fsImpl, onPhase });

  return {
    ...result,
    files: result.files.map((target) => path.basename(target)),
  };
}

export async function writeStaticAssets(assets, options = {}) {
  return writeStaticAssetsAtomically(assets, options);
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await writeStaticAssetsAtomically(await buildStaticAssets());
  if (result.cleanupFailures.length > 0) {
    console.error(formatCleanupFailures(result));
    process.exitCode = cleanupExitCode(result);
  }
}
