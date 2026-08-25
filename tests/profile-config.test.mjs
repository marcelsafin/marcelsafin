import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

import { validateProfileConfig } from "../scripts/lib/profile-config.mjs";

const validConfig = {
  username: "marcelsafin",
  identity: {
    eyebrow: "AI-FIRST DEVELOPER",
    headline:
      "PhD in breaking things apart until I understand how they work.",
    intro: [
      "Curiosity brought me into technology. AI became how I build.",
      "I keep pulling systems apart until I understand enough to build with them.",
    ],
  },
  story: [
    {
      period: "LATE 2023",
      heading: "I wanted to understand how machines are built.",
      paragraphs: [
        "When ChatGPT 3.5 arrived, technology became something I could question, provoke, and take apart.",
        "I learned by experimenting, pushing limits, breaking assumptions, and tracing what happened next.",
        "That loop turned curiosity into a direction.",
      ],
    },
    {
      period: "2024",
      heading: "Frontend became my entry into software.",
      paragraphs: [
        "I started a 400 YH-point Front End Developer program and gained a structured view of JavaScript, APIs, testing, UX, accessibility, agile work, and delivery.",
      ],
    },
    {
      period: "2025",
      heading: "Using AI became AI-first development.",
      paragraphs: [
        "I moved from prompting tools to building systems through them.",
        "My work expanded into agent orchestration, custom harnesses, AI memory, token optimization, and specialized AI-native SaaS products.",
        "I also began running open-weight models in Google Colab with access to approximately 40 GB of VRAM and contributing to open-source projects.",
      ],
    },
    {
      period: "NOW",
      heading: "I am following the systems underneath the tools.",
      paragraphs: [
        "My current focus is graph engineering, context engineering, and machine-learning foundations.",
      ],
    },
  ],
  education: {
    program: "Front End Developer",
    yhPoints: 400,
    areas: [
      "JavaScript and frameworks",
      "API development",
      "Software testing",
      "UX and accessibility",
      "Agile project work",
      "26 weeks of LIA",
      "AI, tools, and sustainable code",
    ],
  },
  howIBuild: {
    intro:
      "AI is not an add-on to my workflow. It is the environment I build through.",
    capabilities: [
      "Problem definition",
      "Product direction",
      "Agent direction",
      "Debugging",
      "Model and tool selection",
      "Deployment",
      "UX",
    ],
  },
  openSource: [
    {
      label: "github/spec-kit",
      url: "https://github.com/github/spec-kit",
      signal: "47 merged PRs",
    },
    {
      label: "github/copilot-cli",
      url: "https://github.com/github/copilot-cli",
      signal: "2 merged PRs",
    },
    {
      label: "github/github-mcp-server",
      url: "https://github.com/github/github-mcp-server",
      signal: "1 merged PR",
    },
    {
      label: "HKUDS/CLI-Anything",
      url: "https://github.com/HKUDS/CLI-Anything",
      signal: "2 merged PRs",
    },
  ],
  currentlyExploring: [
    "Graph engineering",
    "Context engineering",
    "ML foundations",
  ],
  longTermQuestions: ["Robotics", "Medicine", "Biology"],
  contacts: {
    github: "https://github.com/marcelsafin",
    linkedin: "https://www.linkedin.com/in/marcelsafin/",
    email: "mailto:marsel@mynextcode.se",
  },
};

function cloneConfig() {
  return structuredClone(validConfig);
}

test("validateProfileConfig accepts the exact origin story schema and returns a deep clone", () => {
  const result = validateProfileConfig(validConfig);

  assert.deepEqual(result, validConfig);
  assert.notStrictEqual(result, validConfig);
  assert.notStrictEqual(result.identity, validConfig.identity);
  assert.notStrictEqual(result.identity.intro, validConfig.identity.intro);
  assert.notStrictEqual(result.story, validConfig.story);
  assert.notStrictEqual(result.story[0], validConfig.story[0]);
  assert.notStrictEqual(
    result.story[0].paragraphs,
    validConfig.story[0].paragraphs,
  );
  assert.notStrictEqual(result.education, validConfig.education);
  assert.notStrictEqual(result.howIBuild, validConfig.howIBuild);
  assert.notStrictEqual(result.openSource, validConfig.openSource);
  assert.notStrictEqual(result.openSource[0], validConfig.openSource[0]);
  assert.notStrictEqual(result.contacts, validConfig.contacts);

  result.identity.intro[0] = "changed";
  result.story[0].paragraphs[0] = "changed";
  result.education.areas[0] = "changed";
  result.howIBuild.capabilities[0] = "changed";
  result.contacts.github = "https://github.com/other";

  assert.equal(
    validConfig.identity.intro[0],
    "Curiosity brought me into technology. AI became how I build.",
  );
  assert.equal(
    validConfig.story[0].paragraphs[0],
    "When ChatGPT 3.5 arrived, technology became something I could question, provoke, and take apart.",
  );
  assert.equal(validConfig.education.areas[0], "JavaScript and frameworks");
  assert.equal(validConfig.howIBuild.capabilities[0], "Problem definition");
  assert.equal(validConfig.contacts.github, "https://github.com/marcelsafin");
});

test("validateProfileConfig enforces exact top-level and nested keys", () => {
  const cases = [
    ["profile", (config) => (config.vanityMetric = "10k")],
    ["profile.identity", (config) => (config.identity.extra = true)],
    ["profile.story[0]", (config) => (config.story[0].extra = true)],
    ["profile.education", (config) => (config.education.extra = true)],
    ["profile.howIBuild", (config) => (config.howIBuild.extra = true)],
    ["profile.openSource[0]", (config) => (config.openSource[0].extra = true)],
    ["profile.contacts", (config) => (config.contacts.extra = true)],
  ];

  for (const [path, mutate] of cases) {
    const config = cloneConfig();
    mutate(config);
    assert.throws(
      () => validateProfileConfig(config),
      new RegExp(`${escapeRegExp(path)}: unknown key`),
    );
  }

  const missingCases = [
    ["profile.identity", (config) => delete config.identity.eyebrow],
    ["profile.story[0]", (config) => delete config.story[0].heading],
    ["profile.education", (config) => delete config.education.yhPoints],
    ["profile.howIBuild", (config) => delete config.howIBuild.intro],
    ["profile.openSource[0]", (config) => delete config.openSource[0].signal],
    ["profile.contacts", (config) => delete config.contacts.email],
  ];

  for (const [path, mutate] of missingCases) {
    const config = cloneConfig();
    mutate(config);
    assert.throws(
      () => validateProfileConfig(config),
      new RegExp(`${escapeRegExp(path)}: missing key`),
    );
  }
});

test("validateProfileConfig requires exact story periods in order", () => {
  const tooShort = cloneConfig();
  tooShort.story = tooShort.story.slice(0, 3);
  assert.throws(
    () => validateProfileConfig(tooShort),
    (error) => {
      assert.equal(error.message, "profile.story must contain exactly 4 items");
      return true;
    },
  );

  const wrongPeriod = cloneConfig();
  wrongPeriod.story[0].period = "2023";
  assert.throws(
    () => validateProfileConfig(wrongPeriod),
    (error) => {
      assert.equal(
        error.message,
        'profile.story[0].period must equal "LATE 2023"',
      );
      return true;
    },
  );
});

test("validateProfileConfig bounds all configured arrays", () => {
  const cases = [
    ["identity.intro", (config) => (config.identity.intro = ["x".repeat(2), "y", "z", "too many"])],
    [
      "story[0].paragraphs",
      (config) => (config.story[0].paragraphs = ["one", "two", "three", "four", "five"]),
    ],
    [
      "education.areas",
      (config) =>
        (config.education.areas = Array.from({ length: 11 }, (_, index) => `Area ${index}`)),
    ],
    [
      "howIBuild.capabilities",
      (config) =>
        (config.howIBuild.capabilities = [
          ...validConfig.howIBuild.capabilities,
          "Problem definition",
        ]),
    ],
    [
      "currentlyExploring",
      (config) =>
        (config.currentlyExploring = Array.from(
          { length: 7 },
          (_, index) => `Topic ${index}`,
        )),
    ],
    [
      "longTermQuestions",
      (config) =>
        (config.longTermQuestions = Array.from(
          { length: 7 },
          (_, index) => `Question ${index}`,
        )),
    ],
  ];

  for (const [path, mutate] of cases) {
    const config = cloneConfig();
    mutate(config);
    assert.throws(
      () => validateProfileConfig(config),
      new RegExp(`${escapeRegExp(`profile.${path}`)}.*between`),
    );
  }
});

test("validateProfileConfig accepts only approved How I Build capabilities", () => {
  for (const capability of ["Architecture", "Testing", "Code review"]) {
    const config = cloneConfig();
    config.howIBuild.capabilities = [capability];

    assert.throws(
      () => validateProfileConfig(config),
      /profile\.howIBuild\.capabilities\[0\] is not an approved capability/,
    );
  }

  const unsupportedAtIndexSeven = cloneConfig();
  unsupportedAtIndexSeven.howIBuild.capabilities = [
    ...validConfig.howIBuild.capabilities,
    "Architecture",
  ];
  assert.throws(
    () => validateProfileConfig(unsupportedAtIndexSeven),
    (error) => {
      assert.equal(
        error.message,
        "profile.howIBuild.capabilities[7] is not an approved capability",
      );
      return true;
    },
  );

  const duplicate = cloneConfig();
  duplicate.howIBuild.capabilities = ["UX", "UX"];
  assert.throws(
    () => validateProfileConfig(duplicate),
    /profile\.howIBuild\.capabilities must contain unique items/,
  );
});

test("validateProfileConfig requires a safe integer between 1 and 1000 for YH points", () => {
  for (const yhPoints of [
    -1,
    0,
    1001,
    400.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    "400",
  ]) {
    const config = cloneConfig();
    config.education.yhPoints = yhPoints;

    assert.throws(
      () => validateProfileConfig(config),
      /profile\.education\.yhPoints must be a safe integer between 1 and 1000/,
    );
  }

  const config = cloneConfig();
  config.education.yhPoints = 0;
  assert.throws(
    () => validateProfileConfig(config),
    /profile\.education\.yhPoints must be a safe integer between 1 and 1000/,
  );

  for (const yhPoints of [1, 1000]) {
    config.education.yhPoints = yhPoints;
    assert.doesNotThrow(() => validateProfileConfig(config));
  }
});

test("validateProfileConfig accepts exact string limits and rejects one character over", () => {
  const cases = [
    ["profile.identity.eyebrow", 40, (config, value) => (config.identity.eyebrow = value)],
    ["profile.identity.headline", 100, (config, value) => (config.identity.headline = value)],
    ["profile.story[0].heading", 120, (config, value) => (config.story[0].heading = value)],
    [
      "profile.story[0].paragraphs[0]",
      360,
      (config, value) => (config.story[0].paragraphs[0] = value),
    ],
    ["profile.education.program", 80, (config, value) => (config.education.program = value)],
    [
      "profile.education.areas[0]",
      80,
      (config, value) => (config.education.areas[0] = value),
    ],
    [
      "profile.currentlyExploring[0]",
      80,
      (config, value) => (config.currentlyExploring[0] = value),
    ],
    [
      "profile.longTermQuestions[0]",
      80,
      (config, value) => (config.longTermQuestions[0] = value),
    ],
  ];

  for (const [path, maxLength, assign] of cases) {
    const valid = cloneConfig();
    assign(valid, "x".repeat(maxLength));
    assert.doesNotThrow(
      () => validateProfileConfig(valid),
      `${path} accepts ${maxLength}`,
    );

    const overlong = cloneConfig();
    assign(overlong, "x".repeat(maxLength + 1));
    assert.throws(
      () => validateProfileConfig(overlong),
      new RegExp(`${escapeRegExp(path)}.*${maxLength}`),
      `${path} rejects ${maxLength + 1}`,
    );
  }
});

test("validateProfileConfig accepts exact education area count limits", () => {
  const config = cloneConfig();

  for (const length of [5, 10]) {
    config.education.areas = Array.from({ length }, (_, index) => `Area ${index}`);
    assert.doesNotThrow(() => validateProfileConfig(config));
  }
});

test("validateProfileConfig rejects empty, surrounding-whitespace, overlong, and control-bearing strings", () => {
  const cases = [
    ["profile.identity.eyebrow", (config) => (config.identity.eyebrow = " ")],
    [
      "profile.identity.headline",
      (config) => (config.identity.headline = " headline"),
    ],
    [
      "profile.identity.intro[0]",
      (config) => (config.identity.intro[0] = "x".repeat(241)),
    ],
    [
      "profile.education.program",
      (config) => (config.education.program = "program "),
    ],
    [
      "profile.openSource[0].signal",
      (config) => (config.openSource[0].signal = "x".repeat(81)),
    ],
    [
      "profile.currentlyExploring[0]",
      (config) => (config.currentlyExploring[0] = "topic\ninjection"),
    ],
  ];

  for (const [path, mutate] of cases) {
    const config = cloneConfig();
    mutate(config);
    assert.throws(
      () => validateProfileConfig(config),
      new RegExp(escapeRegExp(path)),
    );
  }
});

test("validateProfileConfig rejects mention and email-like tokens in narrative fields", () => {
  const cases = [
    [
      "profile.identity.eyebrow",
      (config, value) => (config.identity.eyebrow = value),
      "@github",
    ],
    [
      "profile.identity.headline",
      (config, value) => (config.identity.headline = value),
      "a@evil.example",
    ],
    [
      "profile.identity.intro[0]",
      (config, value) => (config.identity.intro[0] = value),
      "\u200b@github",
    ],
    [
      "profile.story[0].heading",
      (config, value) => (config.story[0].heading = value),
      "a@evil.example",
    ],
    [
      "profile.story[0].paragraphs[0]",
      (config, value) => (config.story[0].paragraphs[0] = value),
      "@github",
    ],
    [
      "profile.education.program",
      (config, value) => (config.education.program = value),
      "a@evil.example",
    ],
    [
      "profile.education.areas[0]",
      (config, value) => (config.education.areas[0] = value),
      "@github",
    ],
    [
      "profile.howIBuild.intro",
      (config, value) => (config.howIBuild.intro = value),
      "a@evil.example",
    ],
    [
      "profile.howIBuild.capabilities[0]",
      (config, value) => (config.howIBuild.capabilities[0] = value),
      "@github",
    ],
    [
      "profile.openSource[0].label",
      (config, value) => (config.openSource[0].label = value),
      "Contributor @github",
    ],
    [
      "profile.openSource[0].signal",
      (config, value) => (config.openSource[0].signal = value),
      "a@evil.example",
    ],
    [
      "profile.currentlyExploring[0]",
      (config, value) => (config.currentlyExploring[0] = value),
      "@github",
    ],
    [
      "profile.longTermQuestions[0]",
      (config, value) => (config.longTermQuestions[0] = value),
      "a@evil.example",
    ],
  ];

  for (const [path, assign, value] of cases) {
    const config = cloneConfig();
    assign(config, value);

    assert.throws(
      () => validateProfileConfig(config),
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

test("validateProfileConfig allows at-signs in validated URL and mailto fields", () => {
  const config = cloneConfig();
  config.contacts.linkedin = "https://www.linkedin.com/in/marcel@profile/";
  config.contacts.email = "mailto:marsel+tag@mynextcode.se";

  assert.doesNotThrow(() => validateProfileConfig(config));
});

test("validateProfileConfig validates GitHub profile, LinkedIn host, open-source HTTPS, and mailto URLs", () => {
  for (const github of [
    "https://example.com/marcelsafin",
    "https://github.com/other",
    "https://github.com/marcelsafin?tab=overview",
  ]) {
    const config = cloneConfig();
    config.contacts.github = github;
    assert.throws(
      () => validateProfileConfig(config),
      /profile\.contacts\.github/,
    );
  }

  for (const github of [
    "http://github.com/marcelsafin",
    "javascript:alert(1)",
  ]) {
    const config = cloneConfig();
    config.contacts.github = github;
    assert.throws(
      () => validateProfileConfig(config),
      (error) => {
        assert.equal(error.message, "profile.contacts.github must use https:");
        return true;
      },
    );
  }

  for (const linkedin of [
    "http://www.linkedin.com/in/marcelsafin/",
    "https://example.com/in/marcelsafin/",
    "https://www.linkedin.com/",
  ]) {
    const config = cloneConfig();
    config.contacts.linkedin = linkedin;
    assert.throws(
      () => validateProfileConfig(config),
      /profile\.contacts\.linkedin/,
    );
  }

  for (const url of ["not a URL"]) {
    const config = cloneConfig();
    config.openSource[0].url = url;
    assert.throws(
      () => validateProfileConfig(config),
      /profile\.openSource\[0\]\.url/,
    );
  }

  for (const url of ["http://github.com/github/spec-kit", "javascript:alert(1)"]) {
    const config = cloneConfig();
    config.openSource[0].url = url;
    assert.throws(
      () => validateProfileConfig(config),
      (error) => {
        assert.equal(error.message, "profile.openSource[0].url must use https:");
        return true;
      },
    );
  }

  for (const email of [
    "mailto:",
    "mailto: ",
    "mailto:person @example.com",
    "mailto:javascript:alert(1)",
    "mailto:person@example.com?subject=hello",
    "mailto:person@example.com#section",
    "mailto:foo@example.com/bar",
    "mailto:foo@example.com:25",
    "mailto:%00person@example.com",
  ]) {
    const config = cloneConfig();
    config.contacts.email = email;
    assert.throws(
      () => validateProfileConfig(config),
      /profile\.contacts\.email/,
    );
  }
});

test("validateProfileConfig binds open-source proof to the approved public claims", () => {
  const cases = [
    [
      "label",
      "Contributor to another/repository",
      'profile.openSource[0].label must equal "github/spec-kit"',
    ],
    [
      "signal",
      "50+ commits",
      'profile.openSource[0].signal must equal "47 merged PRs"',
    ],
  ];

  for (const [field, value, message] of cases) {
    const config = cloneConfig();
    config.openSource[0][field] = value;

    assert.throws(
      () => validateProfileConfig(config),
      (error) => {
        assert.equal(error.message, message);
        return true;
      },
    );
  }

  const duplicated = cloneConfig();
  duplicated.openSource[1] = structuredClone(duplicated.openSource[0]);
  assert.throws(
    () => validateProfileConfig(duplicated),
    (error) => {
      assert.equal(error.message, "profile.openSource must not repeat repositories");
      return true;
    },
  );

  const emptied = cloneConfig();
  emptied.openSource = [];
  assert.throws(
    () => validateProfileConfig(emptied),
    /profile\.openSource must contain between 1 and 4 items/,
  );

  const subset = cloneConfig();
  subset.openSource = [subset.openSource[0]];
  assert.doesNotThrow(() => validateProfileConfig(subset));

  assert.doesNotThrow(() => validateProfileConfig(cloneConfig()));
});

test("validateProfileConfig accepts only canonical approved repository URLs", () => {
  const canonical = cloneConfig();
  canonical.openSource[0].url = "https://github.com/github/spec-kit/";
  const normalized = validateProfileConfig(canonical);
  assert.equal(
    normalized.openSource[0].url,
    "https://github.com/github/spec-kit",
  );
  assert.equal(
    canonical.openSource[0].url,
    "https://github.com/github/spec-kit/",
  );

  for (const url of [
    "https:///path",
    "https://user:pass@github.com/github/spec-kit",
    "https://github.com/github/spec-kit?tab=readme",
    "https://github.com/github/spec-kit#readme",
    "https://github.com/other/spec-kit",
    "https://gitlab.com/github/spec-kit",
    "https://www.github.com/github/spec-kit",
    "https://github.com/github/other-repository",
    "https://github.com/github/spec-kit//",
  ]) {
    const config = cloneConfig();
    config.openSource[0].url = url;

    assert.throws(
      () => validateProfileConfig(config),
      (error) => {
        assert.match(error.message, /^profile\.openSource\[0\]\.url\b/);
        return true;
      },
      url,
    );
  }
});

test("validateProfileConfig rejects HTTPS URLs over the configured maximum", () => {
  const longUrl = `https://example.com/${"a".repeat(221)}`;
  assert(longUrl.length > 240);

  const config = cloneConfig();
  config.openSource[0].url = longUrl;
  assert.throws(
    () => validateProfileConfig(config),
    /profile\.openSource\[0\]\.url.*240/,
  );
});

test("validateProfileConfig rejects raw NUL and DEL in every URL-bearing path", () => {
  const cases = [
    [
      "profile.contacts.github",
      (config, value) => (config.contacts.github = value),
      "https://github.com/marcelsafin\u0000",
      "https://github.com/marcelsafin\u007f",
    ],
    [
      "profile.contacts.linkedin",
      (config, value) => (config.contacts.linkedin = value),
      "https://www.linkedin.com/in/marcelsafin\u0000",
      "https://www.linkedin.com/in/marcelsafin\u007f",
    ],
    [
      "profile.contacts.email",
      (config, value) => (config.contacts.email = value),
      "mailto:marsel\u0000@mynextcode.se",
      "mailto:marsel\u007f@mynextcode.se",
    ],
    [
      "profile.openSource[0].url",
      (config, value) => (config.openSource[0].url = value),
      "https://github.com/github/spec-kit\u0000",
      "https://github.com/github/spec-kit\u007f",
    ],
  ];

  for (const [path, assign, ...values] of cases) {
    for (const value of values) {
      const config = cloneConfig();
      assign(config, value);
      assert.throws(
        () => validateProfileConfig(config),
        (error) => {
          assert.equal(error.message, `${path} must not contain control characters`);
          return true;
        },
      );
    }
  }
});

test("validateProfileConfig validates the exact public profile data file", () => {
  const profile = JSON.parse(
    readFileSync(new URL("../data/profile.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(profile, validConfig);
  assert.doesNotThrow(() => validateProfileConfig(profile));
});

function escapeRegExp(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
