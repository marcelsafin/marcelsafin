import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { generateProfile } from "../scripts/generate-profile.mjs";
import { validateProfileConfig } from "../scripts/lib/profile-config.mjs";
import { renderProfileReadme } from "../scripts/lib/readme.mjs";
import {
  AtomicWriteError,
  writeFilesAtomically,
} from "../scripts/lib/atomic-files.mjs";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const generatedFiles = [
  "README.md",
  "assets/companion-light.png",
  "assets/companion-dark.png",
  "assets/hero-light.png",
  "assets/hero-dark.png",
  "assets/hero-mobile-light.png",
  "assets/hero-mobile-dark.png",
  "assets/timeline-light.png",
  "assets/timeline-dark.png",
  "assets/timeline-mobile-light.png",
  "assets/timeline-mobile-dark.png",
  "assets/stack-light.png",
  "assets/stack-dark.png",
  "assets/stack-mobile-light.png",
  "assets/stack-mobile-dark.png",
  "assets/opensource-light.png",
  "assets/opensource-dark.png",
  "assets/banner-origin-light.png",
  "assets/banner-origin-dark.png",
  "assets/banner-stack-light.png",
  "assets/banner-stack-dark.png",
  "assets/banner-proof-light.png",
  "assets/banner-proof-dark.png",
  "assets/banner-current-light.png",
  "assets/banner-current-dark.png",
  "assets/banner-contact-light.png",
  "assets/banner-contact-dark.png",
];

async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(projectRoot, ".generator-test-"));
  await fs.mkdir(path.join(root, "assets"));
  await fs.mkdir(path.join(root, "data"));
  await fs.copyFile(
    path.join(projectRoot, "data", "profile.json"),
    path.join(root, "data", "profile.json"),
  );
  await fs.writeFile(path.join(root, "README.md"), "old README\n", "utf8");
  return root;
}

async function removeWorkspace(root) {
  await fs.rm(root, { recursive: true, force: true });
}

async function snapshotGeneratedFiles(root) {
  return Object.fromEntries(
    await Promise.all(
      generatedFiles.map(async (relative) => [
        relative,
        await fs.readFile(path.join(root, relative)),
      ]),
    ),
  );
}

test("generateProfile writes README and the full static asset set locally", async () => {
  const root = await createWorkspace();

  try {
    const result = await generateProfile({ root });

    assert.equal(result.changed, true);
    assert.deepEqual(
      result.files.map((file) => path.relative(root, file)),
      generatedFiles,
    );
    assert.deepEqual(
      (await fs.readdir(path.join(root, "assets"))).sort(),
      generatedFiles.slice(1).map((file) => path.basename(file)).sort(),
    );
    assert.match(
      await fs.readFile(path.join(root, "README.md"), "utf8"),
      /<h1>Marsel Safin — AI-first developer<\/h1>/,
    );
  } finally {
    await removeWorkspace(root);
  }
});

test("checked-in README exactly matches the local renderer", async () => {
  const config = validateProfileConfig(
    JSON.parse(
      await fs.readFile(
        new URL("../data/profile.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const checkedIn = await fs.readFile(
    new URL("../README.md", import.meta.url),
    "utf8",
  );

  assert.equal(checkedIn, renderProfileReadme(config));
});

test("generateProfile repeats without changing bytes or mtimes", async () => {
  const root = await createWorkspace();

  try {
    const first = await generateProfile({ root });
    const before = await Promise.all(
      first.files.map(async (file) => [
        file,
        await fs.readFile(file),
        (await fs.stat(file, { bigint: true })).mtimeNs,
      ]),
    );

    const second = await generateProfile({ root });

    assert.equal(second.changed, false);
    assert.deepEqual(second.files, []);
    for (const [file, bytes, mtimeNs] of before) {
      assert.deepEqual(await fs.readFile(file), bytes);
      assert.equal((await fs.stat(file, { bigint: true })).mtimeNs, mtimeNs);
    }
  } finally {
    await removeWorkspace(root);
  }
});

test("malformed config leaves README and all generated assets unchanged", async () => {
  const root = await createWorkspace();

  try {
    await generateProfile({ root });
    const before = await snapshotGeneratedFiles(root);
    await fs.writeFile(
      path.join(root, "data", "profile.json"),
      JSON.stringify({ username: "marcelsafin" }),
      "utf8",
    );

    await assert.rejects(() => generateProfile({ root }), /missing key/);
    assert.deepEqual(await snapshotGeneratedFiles(root), before);
  } finally {
    await removeWorkspace(root);
  }
});

test("generateProfile does not require obsolete portrait data", async () => {
  const root = await createWorkspace();

  try {
    await assert.doesNotReject(() => generateProfile({ root }));
    await assert.rejects(
      () => fs.lstat(path.join(root, "data", "portrait-ascii.txt")),
      { code: "ENOENT" },
    );
  } finally {
    await removeWorkspace(root);
  }
});

test("generateProfile rejects a concurrent README edit before staging any target", async () => {
  const root = await createWorkspace();
  const readmePath = path.join(root, "README.md");

  try {
    await generateProfile({ root });
    const before = await snapshotGeneratedFiles(root);

    await assert.rejects(
      () =>
        generateProfile({
          root,
          onPhase: async (phase) => {
            if (phase === "lock-acquired") {
              await fs.writeFile(readmePath, "external README edit\n", "utf8");
            }
          },
        }),
      (error) => {
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "conflict");
        assert.match(error.message, /README\.md/);
        assert.match(error.message, /content changed during generation/i);
        return true;
      },
    );

    assert.equal(await fs.readFile(readmePath, "utf8"), "external README edit\n");
    const after = await snapshotGeneratedFiles(root);
    assert.deepEqual(after, { ...before, "README.md": Buffer.from("external README edit\n") });
  } finally {
    await removeWorkspace(root);
  }
});

test("writeFilesAtomically rejects expected-content paths outside targets", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const target = path.join(root, "target.txt");
  const other = path.join(root, "other.txt");

  try {
    await assert.rejects(
      () =>
        writeFilesAtomically(
          { [target]: "after\n" },
          { expectedContents: { [other]: "before\n" } },
        ),
      /expectedContents.*target/i,
    );
    await assert.rejects(
      () =>
        writeFilesAtomically(
          { [target]: "after\n" },
          { expectedContents: { [target]: 42 } },
        ),
      /expectedContents.*string.*null/i,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically detects expected-content conflicts before staging", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const target = path.join(root, "target.txt");
  const lock = path.join(root, ".target.txt.profile-write.lock");

  try {
    await fs.writeFile(target, "current\n", "utf8");

    await assert.rejects(
      () =>
        writeFilesAtomically(
          { [target]: "after\n" },
          { expectedContents: { [target]: "stale\n" } },
        ),
      (error) => {
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "conflict");
        assert.match(error.message, /target\.txt/);
        assert.match(error.message, /content changed during generation/i);
        return true;
      },
    );

    assert.equal(await fs.readFile(target, "utf8"), "current\n");
    await assert.rejects(() => fs.access(lock), { code: "ENOENT" });
    assert.deepEqual(
      (await fs.readdir(root)).filter(
        (name) => name.startsWith(".tmp-") || name.startsWith(".backup-"),
      ),
      [],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically rolls back replaced and absent targets", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const first = path.join(root, "first.txt");
  const second = path.join(root, "second.txt");
  const absent = path.join(root, "absent.txt");

  try {
    await fs.writeFile(first, Buffer.from("first before\n"));
    await fs.writeFile(second, Buffer.from([0, 1, 2, 255]));
    let renameCount = 0;
    const failingFs = {
      ...fs,
      rename: async (source, target) => {
        if (String(source).includes(".tmp-")) {
          renameCount += 1;
          if (renameCount === 2) {
            throw new Error("second target rename failed");
          }
        }
        return fs.rename(source, target);
      },
    };

    await assert.rejects(
      () =>
        writeFilesAtomically(
          {
            [first]: "first after\n",
            [second]: "second after\n",
            [absent]: "absent after\n",
          },
          { fsImpl: failingFs },
        ),
      (error) => {
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "replace");
        assert.equal(error.cause.message, "second target rename failed");
        assert.deepEqual(error.rollbackFailures, []);
        assert.deepEqual(error.cleanupFailures, []);
        return true;
      },
    );

    assert.deepEqual(await fs.readFile(first), Buffer.from("first before\n"));
    assert.deepEqual(await fs.readFile(second), Buffer.from([0, 1, 2, 255]));
    await assert.rejects(() => fs.access(absent), { code: "ENOENT" });
    assert.deepEqual(
      (await fs.readdir(root)).filter((name) => name.startsWith(".tmp-")),
      [],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically staging failure leaves every target unchanged and removes temps", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const first = path.join(root, "first.txt");
  const absent = path.join(root, "absent.txt");

  try {
    await fs.writeFile(first, "first before\n", "utf8");
    const failingFs = {
      ...fs,
      writeFile: async (target, ...args) => {
        if (String(target).includes(".tmp-")) {
          throw new Error("staging write failed");
        }
        return fs.writeFile(target, ...args);
      },
    };

    await assert.rejects(
      () =>
        writeFilesAtomically(
          {
            [first]: "first after\n",
            [absent]: "absent after\n",
          },
          { fsImpl: failingFs },
        ),
      /staging write failed/,
    );

    assert.equal(await fs.readFile(first, "utf8"), "first before\n");
    await assert.rejects(() => fs.access(absent), { code: "ENOENT" });
    assert.deepEqual(
      (await fs.readdir(root)).filter((name) => name.startsWith(".tmp-")),
      [],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically success returns changed paths in object order and skips unchanged entries", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const unchanged = path.join(root, "unchanged.txt");
  const changed = path.join(root, "changed.txt");
  const absent = path.join(root, "absent.txt");

  try {
    await fs.writeFile(unchanged, "same\n", "utf8");
    await fs.writeFile(changed, "old\n", "utf8");
    let writeCount = 0;
    let renameCount = 0;
    const countingFs = {
      ...fs,
      writeFile: async (...args) => {
        writeCount += 1;
        return fs.writeFile(...args);
      },
      rename: async (...args) => {
        renameCount += 1;
        return fs.rename(...args);
      },
    };

    const result = await writeFilesAtomically(
      {
        [unchanged]: "same\n",
        [changed]: "new\n",
        [absent]: "created\n",
      },
      { fsImpl: countingFs },
    );

    assert.deepEqual(result, {
      changed: true,
      files: [changed, absent],
      cleanupFailures: [],
    });

    assert.equal(writeCount, 3);
    assert.equal(renameCount, 2);
    assert.equal(await fs.readFile(unchanged, "utf8"), "same\n");
    assert.equal(await fs.readFile(changed, "utf8"), "new\n");
    assert.equal(await fs.readFile(absent, "utf8"), "created\n");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically preserves binary Buffer contents", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-binary-"));
  const target = path.join(root, "asset.png");
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

  try {
    const result = await writeFilesAtomically({ [target]: bytes });

    assert.equal(result.changed, true);
    assert.deepEqual(await fs.readFile(target), bytes);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically rejects a held lock without mutating targets", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const target = path.join(root, "target.txt");
  const lock = path.join(root, ".target.txt.profile-write.lock");

  try {
    await fs.writeFile(target, "before\n", "utf8");
    await fs.writeFile(lock, "another-owner", "utf8");

    await assert.rejects(
      () => writeFilesAtomically({ [target]: "after\n" }),
      (error) => {
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "lock");
        assert.match(error.message, /target\.txt\.profile-write\.lock/);
        assert.match(error.message, /target\.txt/);
        assert.deepEqual(error.rollbackFailures, []);
        assert.deepEqual(error.cleanupFailures, []);
        return true;
      },
    );

    assert.equal(await fs.readFile(target, "utf8"), "before\n");
    assert.equal(await fs.readFile(lock, "utf8"), "another-owner");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically conflicts on overlapping target locks", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const nested = path.join(root, "nested");
  const first = path.join(root, "a");
  const second = path.join(nested, "b");
  await fs.mkdir(nested);
  let releaseFirst;
  let resolveLocked;
  const firstLocked = new Promise((resolve) => {
    resolveLocked = resolve;
  });
  const holdFirst = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  try {
    const firstRun = writeFilesAtomically(
      {
        [first]: "first-after\n",
        [second]: "second-after\n",
      },
      {
        onPhase: async (phase) => {
          if (phase === "lock-acquired") {
            resolveLocked();
            await holdFirst;
          }
        },
      },
    );

    await firstLocked;
    await assert.rejects(
      () =>
        writeFilesAtomically({
          [second]: "second-second-run\n",
        }),
      (error) => {
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "lock");
        return true;
      },
    );

    releaseFirst();
    assert.deepEqual(await firstRun, {
      changed: true,
      files: [first, second],
      cleanupFailures: [],
    });
    assert.equal(await fs.readFile(first, "utf8"), "first-after\n");
    assert.equal(await fs.readFile(second, "utf8"), "second-after\n");
  } finally {
    releaseFirst?.();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically allows disjoint target locks to proceed", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const nested = path.join(root, "nested");
  const first = path.join(root, "a");
  const second = path.join(nested, "b");
  const disjoint = path.join(root, "c");
  await fs.mkdir(nested);
  let releaseFirst;
  let resolveFirstLocked;
  let resolveDisjointLocked;
  const firstLocked = new Promise((resolve) => {
    resolveFirstLocked = resolve;
  });
  const disjointLocked = new Promise((resolve) => {
    resolveDisjointLocked = resolve;
  });
  const holdFirst = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  try {
    const firstRun = writeFilesAtomically(
      {
        [first]: "first-after\n",
        [second]: "second-after\n",
      },
      {
        onPhase: async (phase) => {
          if (phase === "lock-acquired") {
            resolveFirstLocked();
            await holdFirst;
          }
        },
      },
    );

    await firstLocked;
    const disjointRun = writeFilesAtomically(
      { [disjoint]: "disjoint-after\n" },
      {
        onPhase: async (phase) => {
          if (phase === "lock-acquired") {
            resolveDisjointLocked();
          }
        },
      },
    );

    await disjointLocked;
    assert.deepEqual(await disjointRun, {
      changed: true,
      files: [disjoint],
      cleanupFailures: [],
    });

    releaseFirst();
    assert.deepEqual(await firstRun, {
      changed: true,
      files: [first, second],
      cleanupFailures: [],
    });
  } finally {
    releaseFirst?.();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically releases earlier locks when a later lock fails", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const first = path.join(root, "a");
  const second = path.join(root, "b");
  const firstLock = path.join(root, ".a.profile-write.lock");
  const secondLock = path.join(root, ".b.profile-write.lock");

  try {
    await fs.writeFile(first, "first-before\n", "utf8");
    await fs.writeFile(second, "second-before\n", "utf8");
    await fs.writeFile(secondLock, "another-owner", "utf8");

    await assert.rejects(
      () =>
        writeFilesAtomically({
          [first]: "first-after\n",
          [second]: "second-after\n",
        }),
      (error) => {
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "lock");
        assert.match(error.message, /b\.profile-write\.lock/);
        assert.match(error.message, /target "[^"]*\/b"/i);
        return true;
      },
    );

    await assert.rejects(() => fs.access(firstLock), { code: "ENOENT" });
    assert.equal(await fs.readFile(secondLock, "utf8"), "another-owner");
    assert.equal(await fs.readFile(first, "utf8"), "first-before\n");
    assert.equal(await fs.readFile(second, "utf8"), "second-before\n");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically reports rollback-phase failures when backup restore fails", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const first = path.join(root, "first.txt");
  const second = path.join(root, "second.txt");

  try {
    await fs.writeFile(first, "first-before\n", "utf8");
    await fs.writeFile(second, "second-before\n", "utf8");
    let replacementCount = 0;
    const failingFs = {
      ...fs,
      rename: async (source, target) => {
        if (String(source).includes(".tmp-")) {
          replacementCount += 1;
          if (replacementCount === 2) {
            throw new Error("replacement failed");
          }
        }
        if (String(source).includes(".backup-")) {
          throw new Error("backup restore failed");
        }
        return fs.rename(source, target);
      },
    };

    let capturedError;
    await assert.rejects(
      () =>
        writeFilesAtomically(
          {
            [first]: "first-after\n",
            [second]: "second-after\n",
          },
          { fsImpl: failingFs },
        ),
      (error) => {
        capturedError = error;
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "rollback");
        assert.equal(error.cause.message, "replacement failed");
        assert.match(error.message, /rollback incomplete/i);
        assert.match(error.message, /backups preserved for recovery/i);
        assert.deepEqual(
          error.rollbackFailures.map(({ target }) => target),
          [first],
        );
        assert.match(error.rollbackFailures[0].message, /backup restore failed/);
        assert.equal(error.recoveryFiles.length, 1);
        assert.equal(error.recoveryFiles[0].target, first);
        assert.deepEqual(error.cleanupFailures, []);
        return true;
      },
    );

    const recovery = capturedError.recoveryFiles[0];
    assert.match(path.basename(recovery.backupPath), /^\.backup-first\.txt-/);
    assert.deepEqual(
      await fs.readFile(recovery.backupPath),
      Buffer.from("first-before\n"),
    );
    await fs.rm(recovery.backupPath, { force: true });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically does not overwrite an externally changed target during rollback", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const first = path.join(root, "first.txt");
  const second = path.join(root, "second.txt");

  try {
    await fs.writeFile(first, "first-before\n", "utf8");
    await fs.writeFile(second, "second-before\n", "utf8");
    let replacementCount = 0;
    const failingFs = {
      ...fs,
      rename: async (source, target) => {
        if (String(source).includes(".tmp-")) {
          replacementCount += 1;
          if (replacementCount === 2) {
            throw new Error("replacement failed");
          }
          const result = await fs.rename(source, target);
          if (replacementCount === 1) {
            await fs.writeFile(target, "external-newer\n", "utf8");
          }
          return result;
        }
        return fs.rename(source, target);
      },
    };

    let capturedError;
    await assert.rejects(
      () =>
        writeFilesAtomically(
          {
            [first]: "first-after\n",
            [second]: "second-after\n",
          },
          { fsImpl: failingFs },
        ),
      (error) => {
        capturedError = error;
        assert(error instanceof AtomicWriteError);
        assert.equal(error.phase, "rollback");
        assert.deepEqual(
          error.rollbackFailures.map(({ target }) => target),
          [first],
        );
        assert.match(error.rollbackFailures[0].message, /conflict/i);
        assert.match(error.message, /backups preserved for recovery/i);
        assert.equal(error.recoveryFiles.length, 1);
        assert.equal(error.recoveryFiles[0].target, first);
        return true;
      },
    );

    assert.equal(await fs.readFile(first, "utf8"), "external-newer\n");
    assert.equal(await fs.readFile(second, "utf8"), "second-before\n");
    assert.deepEqual(
      await fs.readFile(capturedError.recoveryFiles[0].backupPath),
      Buffer.from("first-before\n"),
    );
    await fs.rm(capturedError.recoveryFiles[0].backupPath, { force: true });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically reports cleanup failures without reverting a successful commit", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const target = path.join(root, "target.txt");

  try {
    const failingFs = {
      ...fs,
      rm: async (filePath, ...args) => {
        if (String(filePath).includes(".tmp-")) {
          throw new Error("temporary cleanup failed");
        }
        return fs.rm(filePath, ...args);
      },
    };

    const result = await writeFilesAtomically(
      { [target]: "committed\n" },
      { fsImpl: failingFs },
    );

    assert.equal(await fs.readFile(target, "utf8"), "committed\n");
    assert.equal(result.changed, true);
    assert.deepEqual(result.files, [target]);
    assert.ok(result.cleanupFailures.length > 0);
    assert.ok(
      result.cleanupFailures.every(({ path: failurePath }) =>
        failurePath.includes(".tmp-"),
      ),
    );
    assert.match(result.cleanupFailures[0].message, /cleanup failed/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically preserves existing modes and uses 0644 for new files", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const existing = path.join(root, "existing.txt");
  const created = path.join(root, "created.txt");

  try {
    await fs.writeFile(existing, "before\n", { mode: 0o600 });
    await fs.chmod(existing, 0o600);
    await writeFilesAtomically({
      [existing]: "after\n",
      [created]: "created\n",
    });

    assert.equal((await fs.stat(existing)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(created)).mode & 0o777, 0o644);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically rejects symlink targets before staging", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const real = path.join(root, "real.txt");
  const link = path.join(root, "link.txt");

  try {
    await fs.writeFile(real, "real-before\n", "utf8");
    await fs.symlink(real, link);

    await assert.rejects(
      () => writeFilesAtomically({ [link]: "link-after\n" }),
      /symlink/i,
    );
    assert.equal(await fs.readFile(real, "utf8"), "real-before\n");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("writeFilesAtomically rejects symlinked target parents before creating locks", async () => {
  const root = await fs.mkdtemp(path.join(projectRoot, ".atomic-test-"));
  const external = path.join(root, "external");
  const link = path.join(root, "linked-parent");
  const target = path.join(link, "target.txt");

  try {
    await fs.mkdir(external);
    await fs.symlink(external, link, "dir");

    await assert.rejects(
      () => writeFilesAtomically({ [target]: "outside\n" }),
      (error) => {
        assert(error instanceof TypeError);
        assert.match(error.message, /parent/i);
        assert.match(error.message, /symlink/i);
        assert.match(error.message, new RegExp(link.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        return true;
      },
    );
    assert.deepEqual(await fs.readdir(external), []);
    await assert.rejects(() => fs.access(path.join(external, "target.txt")), {
      code: "ENOENT",
    });
    await assert.rejects(
      () => fs.access(path.join(external, ".target.txt.profile-write.lock")),
      { code: "ENOENT" },
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
