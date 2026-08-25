import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanupExitCode,
  formatCleanupFailures,
} from "../scripts/lib/cli-result.mjs";

test("cleanup result handling signals failure and lists every artifact", () => {
  const result = {
    changed: true,
    cleanupFailures: [
      { path: "/workspace/.tmp-README.md-123", message: "permission denied" },
      { path: "/workspace/.README.md.profile-write.lock", message: "busy" },
    ],
  };

  assert.equal(cleanupExitCode(result), 1);
  const message = formatCleanupFailures(result);
  assert.match(message, /Output updated but cleanup incomplete/);
  assert.match(message, /\/workspace\/\.tmp-README\.md-123: permission denied/);
  assert.match(
    message,
    /\/workspace\/\.README\.md\.profile-write\.lock: busy/,
  );
});

test("clean results preserve empty cleanup output and success signal", () => {
  const result = { changed: false, cleanupFailures: [] };

  assert.equal(cleanupExitCode(result), 0);
  assert.equal(formatCleanupFailures(result), "");
});
