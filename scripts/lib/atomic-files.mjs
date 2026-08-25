import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_MODE = 0o644;

/**
 * @typedef {"lock" | "stage" | "replace" | "rollback" | "conflict"} AtomicWritePhase
 */

/**
 * Atomic write failure with a public phase identifying where the operation stopped.
 *
 * @property {AtomicWritePhase | undefined} phase
 */
export class AtomicWriteError extends Error {
  constructor(
    message,
    {
      phase,
      cause,
      rollbackFailures = [],
      cleanupFailures = [],
      recoveryFiles = [],
    } = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AtomicWriteError";
    this.phase = phase;
    this.rollbackFailures = rollbackFailures;
    this.cleanupFailures = cleanupFailures;
    this.recoveryFiles = recoveryFiles;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function failure(pathname, error) {
  return { path: pathname, message: errorMessage(error) };
}

function rollbackFailure(target, error) {
  return { target, message: errorMessage(error) };
}

class LockAcquisitionFailure extends Error {
  constructor(target, lockPath, cause) {
    super(
      `lock "${lockPath}" for target "${target}" failed: ${errorMessage(cause)}`,
      { cause },
    );
    this.target = target;
    this.lockPath = lockPath;
  }
}

function isMissing(error) {
  return error?.code === "ENOENT";
}

function targetLockPath(target) {
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.profile-write.lock`,
  );
}

function compareLockPaths(left, right) {
  if (left.lockPath < right.lockPath) {
    return -1;
  }
  if (left.lockPath > right.lockPath) {
    return 1;
  }
  return 0;
}

function lockEntries(entries) {
  return entries
    .map(({ target }) => ({ target, lockPath: targetLockPath(target) }))
    .sort(compareLockPaths);
}

async function validateTargetParents(fsImpl, entries) {
  const parents = new Set(entries.map(({ target }) => path.dirname(target)));

  for (const parent of parents) {
    let parentInfo;
    try {
      parentInfo = await fsImpl.lstat(parent);
    } catch (error) {
      if (isMissing(error)) {
        throw new TypeError(
          `target parent "${parent}" must exist as a real directory`,
        );
      }
      throw error;
    }

    if (parentInfo.isSymbolicLink()) {
      throw new TypeError(
        `target parent "${parent}" must be a real directory, not a symlink: "${parent}"`,
      );
    }
    if (!parentInfo.isDirectory()) {
      throw new TypeError(
        `target parent "${parent}" must be a real directory`,
      );
    }
  }
}

function validateFiles(files) {
  if (!isPlainObject(files) || Object.keys(files).length === 0) {
    throw new TypeError("files must be a non-empty plain object");
  }

  const targets = new Set();
  const entries = [];
  for (const [target, content] of Object.entries(files)) {
    if (
      !path.isAbsolute(target) ||
      target.includes("\u0000") ||
      path.normalize(target) !== target
    ) {
      throw new TypeError(
        `files target "${target}" must be an absolute normalized path without NUL`,
      );
    }
    if (targets.has(path.normalize(target))) {
      throw new TypeError(`files contains duplicate target "${target}"`);
    }
    if (typeof content !== "string" && !Buffer.isBuffer(content)) {
      throw new TypeError(
        `files["${target}"] must be a string or Buffer`,
      );
    }

    targets.add(path.normalize(target));
    entries.push({
      target,
      content: Buffer.isBuffer(content) ? Buffer.from(content) : content,
    });
  }

  return entries;
}

function validateExpectedContents(expectedContents, entries) {
  if (!isPlainObject(expectedContents)) {
    throw new TypeError("expectedContents must be a plain object");
  }

  const targets = new Set(entries.map(({ target }) => target));
  for (const [target, content] of Object.entries(expectedContents)) {
    if (!targets.has(target)) {
      throw new TypeError(
        `expectedContents target "${target}" must be one of the files targets`,
      );
    }
    if (content !== null && typeof content !== "string") {
      throw new TypeError(
        `expectedContents["${target}"] must be a string or null`,
      );
    }
  }

  return Object.entries(expectedContents);
}

function asBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

async function snapshotTarget(fsImpl, { target, content }) {
  let targetInfo;
  try {
    targetInfo = await fsImpl.lstat(target);
  } catch (error) {
    if (isMissing(error)) {
      return {
        target,
        next: Buffer.from(content, "utf8"),
        previous: null,
        mode: null,
        changed: true,
      };
    }
    throw error;
  }

  if (targetInfo.isSymbolicLink()) {
    throw new TypeError(`target "${target}" must not be a symlink`);
  }
  if (!targetInfo.isFile()) {
    throw new TypeError(`target "${target}" must be a regular file or absent`);
  }

  const targetStats = await fsImpl.stat(target);
  const previous = asBuffer(await fsImpl.readFile(target));
  const next = Buffer.from(content, "utf8");

  return {
    target,
    next,
    previous,
    mode: targetStats.mode & 0o7777,
    changed: !previous.equals(next),
  };
}

function createStagePath(target, prefix) {
  return path.join(
    path.dirname(target),
    `${prefix}${path.basename(target)}-${randomUUID()}`,
  );
}

async function stageEntries(fsImpl, entries, staged) {
  for (const entry of entries) {
    const stagedEntry = {
      ...entry,
      newPath: createStagePath(entry.target, ".tmp-"),
      backupPath:
        entry.previous === null
          ? null
          : createStagePath(entry.target, ".backup-"),
    };
    staged.push(stagedEntry);

    const mode = entry.mode ?? DEFAULT_MODE;
    await fsImpl.writeFile(stagedEntry.newPath, entry.next, {
      flag: "wx",
      mode,
    });
    await fsImpl.chmod(stagedEntry.newPath, mode);
  }

  for (const entry of staged) {
    if (entry.backupPath === null) {
      continue;
    }

    await fsImpl.writeFile(entry.backupPath, entry.previous, {
      flag: "wx",
      mode: entry.mode,
    });
    await fsImpl.chmod(entry.backupPath, entry.mode);
  }
}

async function cleanupPath(fsImpl, pathname, cleanupFailures) {
  try {
    await fsImpl.rm(pathname, { force: true });
  } catch (error) {
    cleanupFailures.push(failure(pathname, error));
  }
}

async function cleanupStaged(
  fsImpl,
  staged,
  cleanupFailures,
  recoveryFiles = [],
) {
  const recoveryPaths = new Set(
    recoveryFiles.map(({ backupPath }) => backupPath),
  );
  const paths = new Set();
  for (const entry of staged) {
    paths.add(entry.newPath);
    if (
      entry.backupPath !== null &&
      !recoveryPaths.has(entry.backupPath)
    ) {
      paths.add(entry.backupPath);
    }
  }

  for (const pathname of paths) {
    await cleanupPath(fsImpl, pathname, cleanupFailures);
  }
}

async function acquireLocks(fsImpl, locks, ownedLocks, cleanupFailures) {
  for (const lock of locks) {
    let handle = null;
    let lockError;
    let ownedLock = null;

    try {
      handle = await fsImpl.open(lock.lockPath, "wx");
      ownedLock = { ...lock, handle };
      ownedLocks.push(ownedLock);
      await handle.writeFile(randomUUID(), "utf8");
    } catch (error) {
      lockError = error;
    } finally {
      if (handle !== null) {
        try {
          await handle.close();
        } catch (error) {
          if (lockError === undefined) {
            lockError = error;
          } else {
            cleanupFailures.push(failure(lock.lockPath, error));
          }
        }
        if (ownedLock !== null) {
          ownedLock.handle = null;
        }
      }
    }

    if (lockError !== undefined) {
      throw new LockAcquisitionFailure(
        lock.target,
        lock.lockPath,
        lockError,
      );
    }
  }
}

async function releaseLocks(fsImpl, ownedLocks, cleanupFailures) {
  for (const lock of ownedLocks) {
    if (lock.handle !== null) {
      try {
        await lock.handle.close();
      } catch (error) {
        cleanupFailures.push(failure(lock.lockPath, error));
      }
      lock.handle = null;
    }
    await cleanupPath(fsImpl, lock.lockPath, cleanupFailures);
  }
}

async function rollback(fsImpl, replaced) {
  const rollbackFailures = [];
  const recoveryFiles = [];

  for (const entry of [...replaced].reverse()) {
    let current;
    try {
      current = asBuffer(await fsImpl.readFile(entry.target));
    } catch (error) {
      rollbackFailures.push(
        rollbackFailure(
          entry.target,
          new Error(
            `rollback conflict: unable to verify current target (${errorMessage(error)})`,
          ),
        ),
      );
      if (entry.previous !== null) {
        recoveryFiles.push({
          target: entry.target,
          backupPath: entry.backupPath,
        });
      }
      continue;
    }

    if (!current.equals(entry.next)) {
      rollbackFailures.push(
        rollbackFailure(
          entry.target,
          new Error("rollback conflict: target changed after replacement"),
        ),
      );
      if (entry.previous !== null) {
        recoveryFiles.push({
          target: entry.target,
          backupPath: entry.backupPath,
        });
      }
      continue;
    }

    try {
      if (entry.previous === null) {
        await fsImpl.unlink(entry.target);
      } else {
        await fsImpl.rename(entry.backupPath, entry.target);
      }
    } catch (error) {
      rollbackFailures.push(rollbackFailure(entry.target, error));
      if (entry.previous !== null) {
        recoveryFiles.push({
          target: entry.target,
          backupPath: entry.backupPath,
        });
      }
    }
  }

  return { rollbackFailures, recoveryFiles };
}

function atomicError(
  phase,
  cause,
  {
    rollbackFailures = [],
    cleanupFailures = [],
    recoveryFiles = [],
    lockFailure = null,
  } = {},
) {
  let message = errorMessage(cause);
  const descriptions = {
    lock: `Atomic write lock acquisition failed${
      lockFailure === null
        ? ""
        : ` for target "${lockFailure.target}" at "${lockFailure.lockPath}"`
    }: ${message}`,
    conflict: `Atomic write conflict: ${message}`,
    stage: `Atomic write staging failed: ${message}`,
    replace: `Atomic replacement failed: ${message}`,
    rollback: `Atomic replacement failed; rollback incomplete: ${message}`,
  };

  message = descriptions[phase];
  if (recoveryFiles.length > 0) {
    message += ` Backups preserved for recovery: ${recoveryFiles
      .map(
        ({ target, backupPath }) =>
          `"${backupPath}" for target "${target}"`,
      )
      .join(", ")}.`;
  }

  return new AtomicWriteError(message, {
    phase,
    cause,
    rollbackFailures,
    cleanupFailures,
    recoveryFiles,
  });
}

export async function writeFilesAtomically(
  files,
  { fsImpl = fs, onPhase, expectedContents = {} } = {},
) {
  const entries = validateFiles(files);
  const expectedEntries = validateExpectedContents(expectedContents, entries);
  if (onPhase !== undefined && typeof onPhase !== "function") {
    throw new TypeError("onPhase must be a function");
  }

  await validateTargetParents(fsImpl, entries);
  const locks = lockEntries(entries);
  const cleanupFailures = [];
  const staged = [];
  const ownedLocks = [];
  let result = null;
  let operationError = null;

  try {
    try {
      await acquireLocks(fsImpl, locks, ownedLocks, cleanupFailures);
    } catch (error) {
      const lockFailure =
        error instanceof LockAcquisitionFailure ? error : null;
      operationError = atomicError(
        "lock",
        lockFailure?.cause ?? error,
        {
          cleanupFailures,
          lockFailure,
        },
      );
    }

    let snapshots = null;
    if (operationError === null) {
      try {
        // Private/test-only hook. Production callers should omit it.
        await onPhase?.("lock-acquired", {
          lockPath: locks[0]?.lockPath,
          lockPaths: locks.map(({ lockPath }) => lockPath),
        });
        snapshots = await Promise.all(
          entries.map((entry) => snapshotTarget(fsImpl, entry)),
        );

        const snapshotsByTarget = new Map(
          snapshots.map((snapshot) => [snapshot.target, snapshot]),
        );
        const conflicts = expectedEntries.filter(([target, expected]) => {
          const previous = snapshotsByTarget.get(target).previous;
          if (expected === null) {
            return previous !== null;
          }
          return (
            previous === null ||
            !previous.equals(Buffer.from(expected, "utf8"))
          );
        });

        if (conflicts.length > 0) {
          const targets = conflicts.map(([target]) => `"${target}"`).join(", ");
          const subject = conflicts.length === 1 ? "Target" : "Targets";
          operationError = atomicError(
            "conflict",
            new Error(
              `${subject} ${targets} content changed during generation.`,
            ),
            { cleanupFailures },
          );
        }
      } catch (error) {
        if (error instanceof TypeError) {
          operationError = error;
        } else {
          operationError = atomicError("stage", error, { cleanupFailures });
        }
      }
    }

    if (operationError === null) {
      const changed = snapshots.filter((entry) => entry.changed);

      if (changed.length === 0) {
        result = { changed: false, files: [] };
      } else {
        try {
          await stageEntries(fsImpl, changed, staged);
        } catch (error) {
          await cleanupStaged(fsImpl, staged, cleanupFailures);
          operationError = atomicError("stage", error, {
            cleanupFailures,
          });
        }

        if (operationError === null) {
          const replaced = [];
          try {
            for (const entry of staged) {
              await fsImpl.rename(entry.newPath, entry.target);
              replaced.push(entry);
            }
          } catch (error) {
            const rollbackResult = await rollback(fsImpl, replaced);
            await cleanupStaged(
              fsImpl,
              staged,
              cleanupFailures,
              rollbackResult.recoveryFiles,
            );
            operationError = atomicError(
              rollbackResult.rollbackFailures.length > 0
                ? "rollback"
                : "replace",
              error,
              {
                rollbackFailures: rollbackResult.rollbackFailures,
                cleanupFailures,
                recoveryFiles: rollbackResult.recoveryFiles,
              },
            );
          }

          if (operationError === null) {
            await cleanupStaged(fsImpl, staged, cleanupFailures);
            result = {
              changed: true,
              files: changed.map(({ target }) => target),
            };
          }
        }
      }
    }
  } finally {
    await releaseLocks(fsImpl, ownedLocks, cleanupFailures);

    if (operationError !== null) {
      operationError.cleanupFailures = cleanupFailures;
    }
    if (result !== null) {
      result.cleanupFailures = cleanupFailures;
    }
  }

  if (operationError !== null) {
    throw operationError;
  }

  return result;
}
