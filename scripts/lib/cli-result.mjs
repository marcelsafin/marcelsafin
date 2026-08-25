export function cleanupExitCode(result) {
  return result?.cleanupFailures?.length > 0 ? 1 : 0;
}

export function formatCleanupFailures(result) {
  const failures = result?.cleanupFailures ?? [];
  if (failures.length === 0) {
    return "";
  }

  const status = result.changed
    ? "Output updated but cleanup incomplete."
    : "Output unchanged but cleanup incomplete.";

  return [
    status,
    ...failures.map(
      ({ path, message }) => `Cleanup failure: ${path}: ${message}`,
    ),
  ].join("\n");
}
