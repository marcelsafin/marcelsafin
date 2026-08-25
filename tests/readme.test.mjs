import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateProfileConfig } from "../scripts/lib/profile-config.mjs";
import * as readme from "../scripts/lib/readme.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const profile = validateProfileConfig(
  JSON.parse(readFileSync(path.join(projectRoot, "data/profile.json"), "utf8")),
);
const expectedAssetReferences = [
  "./assets/hero-mobile-dark.png",
  "./assets/hero-mobile-light.png",
  "./assets/hero-dark.webp",
  "./assets/hero-light.webp",
  "./assets/hero-light.png",
  "./assets/timeline-mobile-dark.png",
  "./assets/timeline-mobile-light.png",
  "./assets/timeline-dark.png",
  "./assets/timeline-light.png",
  "./assets/timeline-light.png",
];

function extractAssetReferences(markdown) {
  return [...markdown.matchAll(/\.\/assets\/[A-Za-z0-9][A-Za-z0-9._/-]*/g)].map(
    (match) => match[0],
  );
}

test("readme module exports only the pure profile renderer", () => {
  assert.equal(typeof readme.renderProfileReadme, "function");
  assert.equal(readme.renderGeneratedBlock, undefined);
  assert.equal(readme.updateGeneratedBlock, undefined);
});

test("renderProfileReadme renders the AI companion landing hierarchy", () => {
  const output = readme.renderProfileReadme(profile);

  assert.equal(output, readme.renderProfileReadme(profile));
  assert.ok(output.startsWith("<picture>\n"));
  assert.match(
    output,
    /<source media="\(max-width: 600px\) and \(prefers-color-scheme: dark\)" srcset="\.\/assets\/hero-mobile-dark\.png">/,
  );
  assert.match(
    output,
    /<source media="\(max-width: 600px\) and \(prefers-color-scheme: light\)" srcset="\.\/assets\/hero-mobile-light\.png">/,
  );
  assert.match(
    output,
    /<source media="\(prefers-color-scheme: dark\)" srcset="\.\/assets\/hero-dark\.webp">/,
  );
  assert.match(
    output,
    /<source media="\(prefers-color-scheme: light\)" srcset="\.\/assets\/hero-light\.webp">/,
  );
  assert.doesNotMatch(output, /hero-static|dashboard\.svg|PROFILE-LIVE/);

  const sections = [
    "<strong>01 / ORIGIN</strong>",
    "THE PATH",
    "I wanted to understand how machines are built.",
    "Frontend became my entry into software.",
    "Using AI became AI-first development.",
    "I am following the systems underneath the tools.",
    "<strong>02 / PROOF</strong>",
    "<h3>Front End Developer</h3>",
    "<h3>How I build</h3>",
    "Open source contributions",
    "<strong>03 / CURRENT</strong>",
    "<h3>Currently exploring</h3>",
    "<h3>Long-term questions</h3>",
    "<strong>04 / CONTACT</strong>",
    '<a href="https://github.com/marcelsafin">GitHub</a> · <a href="https://www.linkedin.com/in/marcelsafin/">LinkedIn</a> · <a href="mailto:marsel@mynextcode.se">Email</a>',
  ];
  let previousIndex = -1;
  for (const section of sections) {
    const index = output.indexOf(section);
    assert.notEqual(index, -1, `missing ${section}`);
    assert.ok(index > previousIndex, `${section} is out of order`);
    previousIndex = index;
  }

  assert.doesNotMatch(output, /path-(?:light|dark)\.svg/);
  assert.equal((output.match(/<table\b/g) ?? []).length, 0);
  assert.equal((output.match(/<picture>/g) ?? []).length, 2);
  assert.equal((output.match(/<ol>|<li>/g) ?? []).length, 0);
  assert.doesNotMatch(output, /timeline-node-/);
  assert.equal((output.match(/<h2>/g) ?? []).length, 4);
  assert.equal((output.match(/<h3>/g) ?? []).length, 9);
  assert.equal((output.match(/<h1>/g) ?? []).length, 1);
  assert.match(output, /<h1>Marsel Safin — AI-first developer<\/h1>/);
  assert.match(
    output,
    /<p><strong><a href="#user-content-the-path">Explore the origin story →<\/a><\/strong><\/p>/,
  );
  assert.match(output, /<a id="the-path"><\/a>/);
  assert.doesNotMatch(output, /<sub>/);
  assert.doesNotMatch(output, /<blockquote>|<details>|<summary>/);
  assert.match(
    output,
    /<img width="1200" alt="Marsel Safin with an original AI companion illustration\. Built with GitHub Copilot\. AI-first development: systems, agents, graphs, and curiosity\." src="\.\/assets\/hero-light\.png">/,
  );
  assert.doesNotMatch(output, /\*\*AI-FIRST DEVELOPER\*\*/);
  assert.doesNotMatch(
    output,
    /# PhD in breaking things apart until I understand how they work\./,
  );
  const heroEnd = output.indexOf("</picture>");
  const pathStart = output.indexOf('\n\n<a id="the-path"></a>');
  assert.equal(
    output.slice(heroEnd + "</picture>".length, pathStart),
    '\n\n<h1>Marsel Safin — AI-first developer</h1>\n\n<p><strong>PhD in breaking things apart until I understand how they work.</strong></p>\n\n<p>Curiosity brought me into technology. AI became how I build.</p>\n\n<p>I keep pulling systems apart until I understand enough to build with them.</p>\n\n<p><strong><a href="#user-content-the-path">Explore the origin story →</a></strong></p>',
  );
  assert.doesNotMatch(output, /<sub><code>01 \/ PATH<\/code><\/sub>|<table\b/);
  assert.match(
    output,
    /<p>Curiosity brought me into technology\. AI became how I build\.<\/p>\n\n<p>I keep pulling systems apart until I understand enough to build with them\.<\/p>/,
  );
  assert.match(
    output,
    /<p><strong>01 \/ ORIGIN<\/strong><\/p>\n<h2>THE PATH<\/h2>/,
  );
  assert.match(
    output,
    /<source media="\(max-width: 600px\) and \(prefers-color-scheme: dark\)" srcset="\.\/assets\/timeline-mobile-dark\.png">/,
  );
  assert.match(
    output,
    /<source media="\(prefers-color-scheme: light\)" srcset="\.\/assets\/timeline-light\.png">/,
  );
  assert.match(
    output,
    /<img width="1200" alt="" src="\.\/assets\/timeline-light\.png">/,
  );
  assert.match(
    output,
    /<p>Problem definition · Product direction · Agent direction · Debugging · Model and tool selection · Deployment · UX<\/p>/,
  );
  assert.match(
    output,
    /Robotics · Medicine · Biology — and what AI could contribute there\./,
  );
  const contactLine =
    '<p><strong><a href="https://github.com/marcelsafin">GitHub</a> · <a href="https://www.linkedin.com/in/marcelsafin/">LinkedIn</a> · <a href="mailto:marsel@mynextcode.se">Email</a></strong></p>';
  assert.ok(
    output.indexOf(contactLine) >
      output.indexOf(
        "Robotics · Medicine · Biology — and what AI could contribute there.",
      ),
  );

  const storyBlocks = [
    [
      "<p><strong>LATE 2023 / CURIOSITY</strong></p>",
      "<h3>I wanted to understand how machines are built.</h3>",
      "When ChatGPT 3.5 arrived, technology became something I could question, provoke, and take apart.",
      "I learned by experimenting, pushing limits, breaking assumptions, and tracing what happened next.",
      "That loop turned curiosity into a direction.",
    ],
    [
      "<p><strong>2024 / EDUCATION</strong></p>",
      "<h3>Frontend became my entry into software.</h3>",
      "I started a 400 YH-point Front End Developer program and gained a structured view of JavaScript, APIs, testing, UX, accessibility, agile work, and delivery.",
    ],
    [
      "<p><strong>2025 / AI-FIRST DEVELOPMENT</strong></p>",
      "<h3>Using AI became AI-first development.</h3>",
      "I moved from prompting tools to building systems through them.",
      "My work expanded into agent orchestration, custom harnesses, AI memory, token optimization, and specialized AI-native SaaS products.",
      "I also began running open-weight models in Google Colab with access to approximately 40 GB of VRAM and contributing to open-source projects.",
    ],
    [
      "<p><strong>NOW / GRAPHS / CONTEXT / ML</strong></p>",
      "<h3>I am following the systems underneath the tools.</h3>",
      "My current focus is graph engineering, context engineering, and machine-learning foundations.",
    ],
  ];
  for (const block of storyBlocks) {
    let previousIndex = -1;
    for (const value of block) {
      const index = output.indexOf(value);
      assert.notEqual(index, -1, `missing story value: ${value}`);
      assert.ok(index > previousIndex, `story value out of order: ${value}`);
      previousIndex = index;
    }
  }
});

test("renderProfileReadme includes required claims without dashboard or generic profile filler", () => {
  const output = readme.renderProfileReadme(profile);

  for (const text of [
    "I wanted to understand how machines are built.",
    "Frontend became my entry into software.",
    "Using AI became AI-first development.",
    "My current focus is graph engineering, context engineering, and machine-learning foundations.",
    "400&nbsp;YH-poäng",
    "<h3>Front End Developer</h3>",
    "When ChatGPT 3.5 arrived, technology became something I could question, provoke, and take apart.",
    "I learned by experimenting, pushing limits, breaking assumptions, and tracing what happened next.",
    "That loop turned curiosity into a direction.",
    "I started a 400 YH-point Front End Developer program and gained a structured view of JavaScript, APIs, testing, UX, accessibility, agile work, and delivery.",
    "My work expanded into agent orchestration, custom harnesses, AI memory, token optimization, and specialized AI-native SaaS products.",
    "I also began running open-weight models in Google Colab with access to approximately 40 GB of VRAM and contributing to open-source projects.",
    "AI is not an add-on to my workflow. It is the environment I build through.",
    "Problem definition",
    "Product direction",
    "Agent direction",
    "Debugging",
    "Model and tool selection",
    "Deployment",
    "UX",
    "Open source contributions",
    '<a href="https://github.com/github/spec-kit">github/spec-kit</a></strong> — 47 merged PRs',
    '<a href="https://github.com/github/copilot-cli">github/copilot-cli</a></strong> — 2 merged PRs',
    '<a href="https://github.com/github/github-mcp-server">github/github-mcp-server</a></strong> — 1 merged PR',
    '<a href="https://github.com/HKUDS/CLI-Anything">HKUDS/CLI-Anything</a></strong> — 2 merged PRs',
    "Graph engineering · Context engineering · ML foundations",
  ]) {
    assert.ok(output.includes(text), `missing ${text}`);
  }

  for (const forbidden of [
    "metrics",
    "Selected systems",
    "Toolkit",
    "availability",
    "fanout",
    "cogwake",
    "getting-prs-merged",
    "Architecture",
    "Code review",
  ]) {
    assert.doesNotMatch(
      output,
      new RegExp(forbidden.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
  }
});

test("renderProfileReadme renders safe HTTPS, mailto, Markdown, and HTML destinations", () => {
  const hostile = structuredClone(profile);
  hostile.identity.eyebrow = `AI-FIRST "DEVELOPER" & <tag>`;
  hostile.identity.headline =
    "Break *things* _now_ [carefully] `then` <inspect> \\ repeat";
  hostile.identity.intro[0] = "Read <systems> *carefully* [now] \\ first.";
  hostile.education.program = "Spec [Kit] *work*";
  hostile.contacts.linkedin = "https://www.linkedin.com/in/marcel) [evil](";

  const output = readme.renderProfileReadme(hostile);
  const linkedinDestination = new URL(hostile.contacts.linkedin).href;

  assert.ok(
    output.includes(
      'alt="Marsel Safin with an original AI companion illustration. Built with GitHub Copilot. AI-first development: systems, agents, graphs, and curiosity."',
    ),
  );
  assert.ok(
    output.includes(
      "<p>Read &lt;systems&gt; *carefully* [now] \\ first.</p>",
    ),
  );
  assert.ok(
    output.includes(
      "<h3>Spec [Kit] *work*</h3>",
    ),
  );
  assert.ok(
    output.includes(`<a href="${linkedinDestination}">LinkedIn</a>`),
  );
});

test("README and renderer reference only existing refined v2 assets", () => {
  const sources = [
    ["rendered README", readme.renderProfileReadme(profile)],
    [
      "README.md",
      readFileSync(path.join(projectRoot, "README.md"), "utf8"),
    ],
  ];

  for (const [label, source] of sources) {
    const references = extractAssetReferences(source);

    assert.deepEqual(references, expectedAssetReferences, label);
    for (const reference of references) {
      assert.equal(
        existsSync(path.join(projectRoot, reference)),
        true,
        `${label} reference does not resolve: ${reference}`,
      );
    }
    assert.doesNotMatch(
      source,
      /dashboard\.svg|hero-static-light\.svg|hero-static-dark\.svg|PROFILE-LIVE/,
      label,
    );
  }
});

test("renderProfileReadme references generated raster assets only", () => {
  const output = readme.renderProfileReadme(profile);

  assert.doesNotMatch(output, /\.svg/);
  for (const name of [
    "hero-light.webp",
    "hero-dark.webp",
    "hero-light.png",
    "hero-mobile-light.png",
    "hero-mobile-dark.png",
    "timeline-light.png",
    "timeline-dark.png",
    "timeline-mobile-light.png",
    "timeline-mobile-dark.png",
  ]) {
    assert.match(output, new RegExp(`assets/${name.replace(".", "\\.")}`));
  }
});

test("asset reference scanner includes Markdown image and link destinations", () => {
  const source = [
    '<img src="./assets/html.svg">',
    "![Markdown image](./assets/image.svg)",
    "[Markdown link](./assets/link.svg)",
  ].join("\n");

  assert.deepEqual(extractAssetReferences(source), [
    "./assets/html.svg",
    "./assets/image.svg",
    "./assets/link.svg",
  ]);
});

test("renderProfileReadme escapes hostile plain text without adding Markdown structure", () => {
  const hostile = structuredClone(profile);
  hostile.identity.intro[0] = "# heading";
  hostile.identity.intro[1] = "- list";
  hostile.story[0].paragraphs[0] = "---";
  hostile.story[0].paragraphs[1] = "~~strike~~";
  hostile.story[0].paragraphs[2] = "> quote";
  hostile.story[1].paragraphs[0] = "1. item";
  hostile.education.areas[0] = "a|b";
  hostile.education.areas[1] = "[x](javascript:alert(1))";
  hostile.education.areas[2] = "{brace} !image! (paren)";
  hostile.currentlyExploring[0] = "+ plus";
  hostile.currentlyExploring[1] = "https://evil.example/path";

  const output = readme.renderProfileReadme(hostile);

  for (const escaped of [
    "# heading",
    "- list",
    "&gt; quote",
    "1. item",
    "a|b",
    "[x](javascript:alert(1))",
    "{brace} !image! (paren)",
    "+ plus · https://evil.example/path · ML foundations",
  ]) {
    assert.ok(output.includes(escaped), `missing escaped text: ${escaped}`);
  }

  assert.doesNotMatch(output, /^# heading$/m);
  assert.doesNotMatch(output, /^- list$/m);
  assert.equal((output.match(/^---$/gm) ?? []).length, 0);
  assert.doesNotMatch(output, /^> quote$/m);
  assert.doesNotMatch(output, /^1\. item$/m);
  assert.doesNotMatch(output, /^\|.*\|$/m);
  assert.doesNotMatch(output, /href="javascript:/);
  assert.equal((output.match(/<table\b/g) ?? []).length, 0);
  assert.equal((output.match(/<h2>/g) ?? []).length, 4);
  assert.equal((output.match(/<h3>/g) ?? []).length, 9);
  assert.equal((output.match(/\]\(<(?:https|mailto):/g) ?? []).length, 0);
  assert.equal((output.match(/<a href="https:/g) ?? []).length, 6);
  assert.equal((output.match(/<a href="mailto:/g) ?? []).length, 1);
});

test("renderProfileReadme rejects unsafe direct configs instead of rendering them", () => {
  const cases = [
    ["openSource.url", (config) => (config.openSource[0].url = "http://example.com")],
    [
      "contacts.email",
      (config) => (config.contacts.email = "mailto:person@example.com?subject=unsafe"),
    ],
    [
      "contacts.github",
      (config) => (config.contacts.github = "javascript:alert(1)"),
    ],
  ];

  for (const [path, mutate] of cases) {
    const config = structuredClone(profile);
    mutate(config);
    if (path === "openSource.url") {
      assert.throws(
        () => readme.renderProfileReadme(config),
        (error) => {
          assert.equal(error.message, "profile.openSource[0].url must use https:");
          return true;
        },
      );
    } else if (path === "contacts.github") {
      assert.throws(
        () => readme.renderProfileReadme(config),
        (error) => {
          assert.equal(error.message, "profile.contacts.github must use https:");
          return true;
        },
      );
    } else {
      assert.throws(
        () => readme.renderProfileReadme(config),
        new RegExp(path.replaceAll(".", "\\.")),
      );
    }
  }
});

test("renderProfileReadme rejects narrative mention and email-like tokens before rendering", () => {
  const cases = [
    [
      "profile.identity.intro[0]",
      (config) => (config.identity.intro[0] = "a@evil.example"),
    ],
    [
      "profile.currentlyExploring[0]",
      (config) => (config.currentlyExploring[0] = "\u200b@github"),
    ],
  ];

  for (const [path, mutate] of cases) {
    const config = structuredClone(profile);
    mutate(config);

    assert.throws(
      () => readme.renderProfileReadme(config),
      (error) => {
        assert.equal(
          error.message,
          `${path} mentions/email-like tokens are not allowed`,
        );
        return true;
      },
      path,
    );
  }
});

test("renderProfileReadme does not mutate its input config", () => {
  const input = structuredClone(profile);
  const snapshot = structuredClone(input);

  readme.renderProfileReadme(input);

  assert.deepEqual(input, snapshot);
});

test("renderProfileReadme keeps valid one-to-three-line intro configs renderable", () => {
  for (const intro of [
    ["One thesis."],
    ["Primary thesis.", "Supporting claim.", "Closing claim."],
  ]) {
    const candidate = structuredClone(profile);
    candidate.identity.intro = intro;
    const output = readme.renderProfileReadme(candidate);

    assert.doesNotMatch(output, /<blockquote>/);
    for (const claim of intro) {
      assert.ok(output.includes(claim));
    }
  }
});
