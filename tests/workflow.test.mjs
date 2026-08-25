import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const WORKFLOW_URL = new URL(
  "../.github/workflows/update-profile.yml",
  import.meta.url,
);

const EXPECTED_ACTION_PINS = new Set([
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
]);

const EXPECTED_PROFILE_FILES = [
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
];

function extractYamlBlock(text, heading, indent) {
  const lines = text.split("\n");
  const prefix = " ".repeat(indent);
  const start = lines.findIndex((line) => line === `${prefix}${heading}:`);
  assert.notEqual(start, -1, `missing YAML block ${heading}`);

  const end = lines.findIndex((line, index) => {
    if (index <= start || line.trim() === "") {
      return false;
    }
    return line.length - line.trimStart().length <= indent;
  });

  return lines.slice(start, end === -1 ? lines.length : end).join("\n");
}

function extractSteps(job) {
  const lines = job.split("\n");
  const starts = [];
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^      - name: (.+)$/);
    if (match) {
      starts.push({ index, name: match[1] });
    }
  }

  return new Map(
    starts.map(({ index, name }, position) => {
      const end = starts[position + 1]?.index ?? lines.length;
      return [name, lines.slice(index, end).join("\n")];
    }),
  );
}

function stepIndex(steps, name) {
  return [...steps.keys()].indexOf(name);
}

async function readWorkflow() {
  return fs.readFile(WORKFLOW_URL, "utf8");
}

function extractPushPaths(workflow) {
  const push = extractYamlBlock(workflow, "push", 2);
  const pathsSection = push.match(
    /^    paths:\n((?:      - .+\n?)+)/m,
  )?.[1];
  assert.ok(pathsSection);
  return [
    ...pathsSection.matchAll(/^      - ["']?([^"'\n]+)["']?$/gm),
  ].map((match) => match[1]);
}

function extractTriggerNames(workflow) {
  const triggers = extractYamlBlock(workflow, "on", 0);
  return [
    ...triggers.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm),
  ].map((match) => match[1]);
}

test("workflow uses only the four immutable action pins", async () => {
  const workflow = await readWorkflow();
  const pins = [
    ...workflow.matchAll(
      /^[ \t]+uses:[ \t]+([^\s#]+)(?:[ \t]+#.*)?$/gm,
    ),
  ].map((match) => match[1]);

  assert.ok(pins.length > 0);
  assert.ok(pins.every((pin) => /@[0-9a-f]{40}$/i.test(pin)));
  assert.deepEqual(new Set(pins), EXPECTED_ACTION_PINS);
});

test("workflow permissions stay isolated by job", async () => {
  const workflow = await readWorkflow();
  const test = extractYamlBlock(workflow, "test", 2);
  const generate = extractYamlBlock(workflow, "generate", 2);
  const publish = extractYamlBlock(workflow, "publish", 2);

  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(test, /^    permissions:\n      contents: read$/m);
  assert.match(generate, /^    permissions:\n      contents: read$/m);
  assert.match(publish, /^    permissions:\n      contents: write$/m);
  assert.doesNotMatch(workflow, /pull-requests:\s*write/);
  assert.doesNotMatch(workflow, /\bwrite-all\b/);
});

test("test and generate pin one immutable event SHA while publishing stays isolated", async () => {
  const workflow = await readWorkflow();
  const test = extractYamlBlock(workflow, "test", 2);
  const generate = extractYamlBlock(workflow, "generate", 2);
  const publish = extractYamlBlock(workflow, "publish", 2);
  const testSteps = extractSteps(test);
  const generateSteps = extractSteps(generate);
  const publishSteps = extractSteps(publish);
  const testCheckout = testSteps.get("Check out repository");
  const generateCheckout = generateSteps.get("Check out repository");
  const publishCheckout = publishSteps.get("Check out repository");

  assert.match(test, /^    runs-on: ubuntu-latest$/m);
  assert.match(test, /^    timeout-minutes: 10$/m);
  assert.match(testCheckout, /uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(testCheckout, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(testCheckout, /persist-credentials: false/);
  assert.match(generate, /^    outputs:\n      base-sha: \$\{\{ steps\.base\.outputs\.sha \}\}$/m);
  assert.match(generate, /^    needs: test$/m);
  assert.match(generateCheckout, /uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(publish, /^    needs: generate$/m);
  assert.match(generateCheckout, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(generateCheckout, /persist-credentials: false/);
  assert.match(testSteps.get("Install dependencies"), /run: npm ci/);
  assert.match(generateSteps.get("Install dependencies"), /run: npm ci/);
  assert.match(test, /CHROME_PATH: \/usr\/bin\/google-chrome/);
  assert.match(generate, /CHROME_PATH: \/usr\/bin\/google-chrome/);
  const testRef = testCheckout.match(/^          ref: (.+)$/m)?.[1];
  const generateRef = generateCheckout.match(/^          ref: (.+)$/m)?.[1];
  assert.equal(testRef, "${{ github.sha }}");
  assert.equal(generateRef, "${{ github.sha }}");
  assert.equal(testRef, generateRef);
  assert.doesNotMatch(
    testCheckout,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.doesNotMatch(
    generateCheckout,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(
    publishCheckout,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(publishCheckout, /persist-credentials: true/);
});

test("workflow runs only for source changes or manual dispatch", async () => {
  const workflow = await readWorkflow();
  const push = extractYamlBlock(workflow, "push", 2);

  assert.match(workflow, /^name: Build profile$/m);
  assert.match(workflow, /^\s+workflow_dispatch:$/m);
  assert.doesNotMatch(workflow, /^\s+schedule:$/m);
  assert.deepEqual(extractTriggerNames(workflow), [
    "workflow_dispatch",
    "push",
  ]);
  assert.match(push, /^    branches:\n      - main$/m);
  assert.deepEqual(
    extractPushPaths(workflow),
    [
      "data/profile.json",
      "scripts/**",
      "tests/**",
      ".github/workflows/update-profile.yml",
    ],
  );
  assert.doesNotMatch(push, /README\.md|assets\//);
});

test("generation is local and token-free", async () => {
  const workflow = await readWorkflow();
  const test = extractYamlBlock(workflow, "test", 2);
  const generate = extractYamlBlock(workflow, "generate", 2);
  const publish = extractYamlBlock(workflow, "publish", 2);
  const testSteps = extractSteps(test);
  const steps = extractSteps(generate);
  const testCheckout = testSteps.get("Check out repository");
  const testSetupNode = testSteps.get("Set up Node");
  const testStep = testSteps.get("Test");
  const generateCheckout = steps.get("Check out repository");
  const setupNodeStep = steps.get("Set up Node");
  const generateStep = steps.get("Generate profile");
  const baseStep = steps.get("Capture base SHA");

  assert.match(testCheckout, /uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(testCheckout, /persist-credentials: false/);
  assert.match(testSetupNode, /uses: actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.match(testSetupNode, /^\s+node-version: 24$/m);
  assert.match(testStep, /^\s+run: npm test$/m);
  assert.doesNotMatch(test, /GITHUB_TOKEN/);

  assert.match(generate, /^    needs: test$/m);
  assert.match(generateCheckout, /uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(generateCheckout, /persist-credentials: false/);
  assert.match(setupNodeStep, /uses: actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.match(setupNodeStep, /^\s+node-version: 24$/m);
  assert.doesNotMatch(generate, /^\s+run: npm test$/m);
  assert.match(generateStep, /^\s+run: npm run generate$/m);
  assert.equal(steps.has("Generate static hero assets"), false);
  assert.equal(steps.has("Generate public dashboard"), false);
  assert.doesNotMatch(workflow, /GITHUB_TOKEN|Generate public dashboard/);
  assert.doesNotMatch(publish, /GITHUB_TOKEN/);
  assert.match(baseStep, /^      - name: Capture base SHA\n\s+id: base$/m);
  assert.match(baseStep, /git rev-parse HEAD/);
  assert.match(baseStep, /GITHUB_OUTPUT/);
});

test("publish transfers and validates only generated profile artifacts", async () => {
  const workflow = await readWorkflow();
  const publish = extractYamlBlock(workflow, "publish", 2);
  const steps = extractSteps(publish);
  const upload = extractSteps(extractYamlBlock(workflow, "generate", 2)).get(
    "Upload generated profile",
  );
  const download = steps.get("Download generated profile");
  const validation = steps.get("Validate generated artifact");
  const copy = steps.get("Copy generated profile");
  const expectedFiles = EXPECTED_PROFILE_FILES;
  const uploadPathBlock = upload.match(
    /^          path: \|\n((?:            \S+\n?)+)/m,
  )?.[1];
  const validationAllowlist = validation.match(
    /^\s+expected_files=\(\n((?:\s+"[^"]+"\n?)+)\s+\)/m,
  )?.[1];

  assert.doesNotMatch(
    workflow,
    /assets\/portrait-ascii-(?:light|dark)\.svg/,
  );
  assert.doesNotMatch(workflow, /assets\/path-(?:light|dark)\.svg/);
  assert.doesNotMatch(workflow, /portrait-ascii\.txt/);
  assert.match(upload, /name: generated-profile/);
  assert.ok(uploadPathBlock);
  assert.deepEqual(
    uploadPathBlock.trim().split("\n").map((line) => line.trim()),
    expectedFiles,
  );
  assert.doesNotMatch(upload, /assets\/\*\.svg/);
  assert.match(upload, /retention-days: 1/);
  assert.match(upload, /if-no-files-found: error/);
  assert.match(download, /name: generated-profile/);
  assert.match(download, /path: \$\{\{ runner\.temp \}\}\/generated-profile/);
  assert.doesNotMatch(download, /\.generated-profile/);

  assert.match(
    validation,
    /env:\n\s+GENERATED_PROFILE_DIR: \$\{\{ runner\.temp \}\}\/generated-profile/,
  );
  assert.match(validation, /artifact="\$GENERATED_PROFILE_DIR"/);
  assert.match(validation, /expected_files=\(/);
  assert.ok(validationAllowlist);
  assert.deepEqual(
    validationAllowlist
      .trim()
      .split("\n")
      .map((line) => line.trim().replace(/^"|"$/g, "")),
    expectedFiles,
  );
  assert.match(validation, /find -P "\$artifact" -mindepth 1 -print0/);
  assert.match(validation, /case "\$relative" in/);
  const validationCaseArms = [
    ...validation.matchAll(
      /^[ \t]+([^()\r\n]+)\)[ \t]*\r?\n[ \t]+;;[ \t]*$/gm,
    ),
  ].map((match) => match[1].trim());
  assert.deepEqual(validationCaseArms, [
    "assets",
    expectedFiles.join("|"),
  ]);
  assert.deepEqual(validationCaseArms[1].split("|"), expectedFiles);
  assert.match(validation, /Unexpected file or directory in generated artifact/);
  assert.match(validation, /! -f "\$path" \|\| -L "\$path"/);
  assert.doesNotMatch(validation, /assets\/\*\.svg/);

  assert.match(
    copy,
    /env:\n\s+GENERATED_PROFILE_DIR: \$\{\{ runner\.temp \}\}\/generated-profile/,
  );
  const copyRun = copy.slice(copy.indexOf("run:"));
  const firstCopy = copyRun.indexOf("cp --");
  assert.ok(firstCopy > copyRun.indexOf("if [[ ! -f README.md"));
  assert.ok(firstCopy > copyRun.indexOf("if [[ ! -d assets"));
  assert.match(copy, /!\s+-f README\.md \|\| -L README\.md/);
  assert.match(copy, /!\s+-d assets \|\| -L assets/);
  const destinationSafetyFiles = [
    ...copy.matchAll(
      /^[ \t]+for filename in ([^\r\n]+); do[ \t]*$/gm,
    ),
  ].flatMap((match) =>
    match[1]
      .trim()
      .split(/[ \t]+/)
      .map((filename) => `assets/${filename}`),
  );
  assert.deepEqual(destinationSafetyFiles, expectedFiles.slice(1));

  const copyCommandLines = copyRun
    .split("\n")
    .filter((line) => line.trimStart().startsWith("cp --"));
  const copyCommands = copyCommandLines.map((line) => {
    const match = line.match(
      /^[ \t]+cp --[ \t]+("[^"\r\n]+"|\S+)[ \t]+("[^"\r\n]+"|\S+)[ \t]*$/,
    );
    assert.ok(match, `unparseable copy command: ${line.trim()}`);
    return {
      source: match[1].replace(/^"|"$/g, ""),
      destination: match[2].replace(/^"|"$/g, ""),
    };
  });
  assert.deepEqual(
    copyCommands.map(({ destination }) => destination),
    expectedFiles,
  );
  assert.deepEqual(
    copyCommands.map(({ source }) => source),
    expectedFiles.map((expectedFile) => `$GENERATED_PROFILE_DIR/${expectedFile}`),
  );
  assert.doesNotMatch(copy, /assets\/\*\.svg/);
});

test("publish verifies stale head before copying or staging", async () => {
  const workflow = await readWorkflow();
  const publish = extractYamlBlock(workflow, "publish", 2);
  const steps = extractSteps(publish);
  const staleHead = steps.get("Verify source head");
  const staleHeadRun = staleHead.slice(staleHead.indexOf("run:"));

  assert.match(staleHead, /git rev-parse HEAD/);
  assert.match(
    staleHead,
    /env:\n\s+EXPECTED_BASE_SHA: \$\{\{ needs\.generate\.outputs\.base-sha \}\}/,
  );
  assert.match(staleHeadRun, /\$current_sha.*"\$EXPECTED_BASE_SHA"/);
  assert.doesNotMatch(
    staleHeadRun,
    /\$\{\{ needs\.generate\.outputs\.base-sha \}\}/,
  );
  assert.match(staleHead, /Default branch advanced during generation/);
  assert.match(staleHeadRun, /Expected base SHA \$EXPECTED_BASE_SHA/);
  assert.ok(
    stepIndex(steps, "Verify source head") <
      stepIndex(steps, "Copy generated profile"),
  );
  assert.ok(
    stepIndex(steps, "Verify source head") <
      stepIndex(steps, "Commit generated changes"),
  );
});

test("publish stages before checking cached changes and pushes exact bot commit", async () => {
  const workflow = await readWorkflow();
  const publish = extractYamlBlock(workflow, "publish", 2);
  const steps = extractSteps(publish);
  const commit = steps.get("Commit generated changes");
  const commitRun = commit.slice(commit.indexOf("run:"));
  const gitAddTokens = commitRun
    .split("\n")
    .filter((line) => line.trimStart().startsWith("git add "))
    .flatMap((line) => line.trim().split(/\s+/).slice(2));
  const cachedDiffIndex = commitRun.indexOf("git diff --cached --quiet");

  assert.deepEqual(gitAddTokens, EXPECTED_PROFILE_FILES);
  assert.doesNotMatch(commit, /git add README\.md assets\/\*\.svg/);
  assert.ok(cachedDiffIndex > commitRun.indexOf("git add "));
  assert.match(commit, /if git diff --cached --quiet; then/);
  assert.match(commit, /Generated profile is already current\./);
  assert.match(commit, /exit 0/);
  assert.match(commit, /git config user\.name "github-actions\[bot\]"/);
  assert.match(
    commit,
    /git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/,
  );
  assert.match(commit, /-m "chore: rebuild profile"/);
  assert.match(
    commit,
    /-m "Co-authored-by: Copilot <223556219\+Copilot@users\.noreply\.github\.com>"/,
  );
  assert.match(
    commit,
    /env:\n\s+DEFAULT_BRANCH: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.doesNotMatch(
    commitRun,
    /\$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(
    commitRun,
    /git push origin "HEAD:\$DEFAULT_BRANCH"/,
  );
});

test("publish contains no project runtime or script commands", async () => {
  const workflow = await readWorkflow();
  const publish = extractYamlBlock(workflow, "publish", 2);

  assert.doesNotMatch(
    publish,
    /^[ \t]+(?:run:[ \t]+)?(?:npm|node)\b|scripts\//m,
  );
});

test("workflow keeps concurrency and job limits", async () => {
  const workflow = await readWorkflow();
  const test = extractYamlBlock(workflow, "test", 2);
  const generate = extractYamlBlock(workflow, "generate", 2);
  const publish = extractYamlBlock(workflow, "publish", 2);

  assert.match(
    workflow,
    /^concurrency:\n  group: build-profile\n  cancel-in-progress: false$/m,
  );
  assert.match(test, /^    runs-on: ubuntu-latest$/m);
  assert.match(test, /^    timeout-minutes: 10$/m);
  assert.match(generate, /^    runs-on: ubuntu-latest$/m);
  assert.match(generate, /^    timeout-minutes: 10$/m);
  assert.match(publish, /^    runs-on: ubuntu-latest$/m);
  assert.match(publish, /^    timeout-minutes: 10$/m);
});
