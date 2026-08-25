import { validateProfileConfig } from "./profile-config.mjs";

const HERO_DARK = "./assets/hero-dark.png";
const HERO_LIGHT = "./assets/hero-light.png";
const HERO_MOBILE_DARK = "./assets/hero-mobile-dark.png";
const HERO_MOBILE_LIGHT = "./assets/hero-mobile-light.png";
const TIMELINE_DARK = "./assets/timeline-dark.png";
const TIMELINE_LIGHT = "./assets/timeline-light.png";
const TIMELINE_MOBILE_DARK = "./assets/timeline-mobile-dark.png";
const TIMELINE_MOBILE_LIGHT = "./assets/timeline-mobile-light.png";
const STORY_META = [
  "LATE 2023 / CURIOSITY",
  "2024 / EDUCATION",
  "2025 / AI-FIRST DEVELOPMENT",
  "NOW / GRAPHS / CONTEXT / ML",
];
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u;
const MARKDOWN_ESCAPABLE_CHARACTERS = new Set([
  "\\",
  "`",
  "*",
  "_",
  "[",
  "]",
  "#",
  "<",
  ">",
  "(",
  ")",
  "{",
  "}",
  "!",
  "|",
  "~",
  "$",
  ":",
  "@",
  "^",
]);

export function renderProfileReadme(config) {
  const profile = validateProfileConfig(config);
  const sections = [
    renderHero(profile.identity),
    renderIdentity(profile.identity),
    renderPath(profile.story),
    renderProof(profile.education, profile.howIBuild, profile.openSource),
    renderCurrentAndFuture(
      profile.currentlyExploring,
      profile.longTermQuestions,
    ),
    renderContacts(profile.contacts),
  ];

  return `${sections.join("\n\n")}\n`;
}

function renderHero(identity) {
  const alt = escapeHtmlAttribute(
    "Marsel Safin with an original AI companion illustration. Built with GitHub Copilot. AI-first development: systems, agents, graphs, and curiosity.",
  );

  return [
    "<picture>",
    `  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="${HERO_MOBILE_DARK}">`,
    `  <source media="(max-width: 600px) and (prefers-color-scheme: light)" srcset="${HERO_MOBILE_LIGHT}">`,
    `  <source media="(prefers-color-scheme: dark)" srcset="${HERO_DARK}">`,
    `  <source media="(prefers-color-scheme: light)" srcset="${HERO_LIGHT}">`,
    `  <img width="1200" height="760" alt="${alt}" src="${HERO_LIGHT}">`,
    "</picture>",
  ].join("\n");
}

function renderIdentity(identity) {
  return [
    "<h1>Marsel Safin — AI-first developer</h1>",
    `<p><strong>${escapeHtmlText(identity.headline)}</strong></p>`,
    ...identity.intro.map(
      (paragraph) => `<p>${escapeHtmlText(paragraph)}</p>`,
    ),
    '<p><strong><a href="#user-content-the-path">Explore the origin story →</a></strong></p>',
  ].join("\n\n");
}

function renderPath(story) {
  const entries = story.flatMap((chapter, index) => [
    ...(index === 0 ? [] : ["<hr>"]),
    `<p><strong>${escapeHtmlText(STORY_META[index])}</strong></p>`,
    `<h3>${escapeHtmlText(chapter.heading)}</h3>`,
    ...chapter.paragraphs.map(
      (paragraph) => `<p>${escapeHtmlText(paragraph)}</p>`,
    ),
  ]);

  return [
    '<a id="the-path"></a>',
    "<p><strong>01 / ORIGIN</strong></p>",
    "<h2>THE PATH</h2>",
    "<picture>",
    `  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="${TIMELINE_MOBILE_DARK}">`,
    `  <source media="(max-width: 600px) and (prefers-color-scheme: light)" srcset="${TIMELINE_MOBILE_LIGHT}">`,
    `  <source media="(prefers-color-scheme: dark)" srcset="${TIMELINE_DARK}">`,
    `  <source media="(prefers-color-scheme: light)" srcset="${TIMELINE_LIGHT}">`,
    `  <img width="1200" height="820" alt="" src="${TIMELINE_LIGHT}">`,
    "</picture>",
    ...entries,
  ].join("\n");
}

function renderProof(education, howIBuild, openSource) {
  const contributions = openSource.map((entry, index) => {
    const url = safeDestinationUrl(
      entry.url,
      `profile.openSource[${index}].url`,
      "https:",
    );
    return `<p><strong><a href="${escapeHtmlAttribute(url)}">${escapeHtmlText(entry.label)}</a></strong> — ${escapeHtmlText(entry.signal)}</p>`;
  });

  return [
    "<hr>",
    "<p><strong>02 / PROOF</strong></p>",
    "<h2>Proof</h2>",
    `<h3>${escapeHtmlText(education.program)}</h3>`,
    `<p><strong>${education.yhPoints}&nbsp;YH-poäng / EDUCATION / FOUNDATIONS</strong></p>`,
    `<p>${education.areas.map(escapeHtmlText).join(" · ")}</p>`,
    "<hr>",
    "<h3>How I build</h3>",
    "<p><strong>FRAME / BUILD / REFINE</strong></p>",
    `<p>${escapeHtmlText(howIBuild.intro)}</p>`,
    `<p>${howIBuild.capabilities.map(escapeHtmlText).join(" · ")}</p>`,
    "<hr>",
    "<h3>Open source contributions</h3>",
    "<p><strong>OPEN SOURCE / PUBLIC PROOF</strong></p>",
    ...contributions,
  ].join("\n");
}

function renderCurrentAndFuture(currentlyExploring, longTermQuestions) {
  return [
    "<hr>",
    "<p><strong>03 / CURRENT</strong></p>",
    "<h2>Questions</h2>",
    "<h3>Currently exploring</h3>",
    "<p><strong>NEAR TERM / TECHNICAL DEPTH</strong></p>",
    `<p>${currentlyExploring.map(escapeHtmlText).join(" · ")}</p>`,
    "<hr>",
    "<h3>Long-term questions</h3>",
    "<p><strong>LONG TERM / MEANINGFUL SYSTEMS</strong></p>",
    `<p>${longTermQuestions.map(escapeHtmlText).join(" · ")} — and what AI could contribute there.</p>`,
  ].join("\n");
}

function renderContacts(contacts) {
  const links = [
    `<a href="${escapeHtmlAttribute(safeDestinationUrl(contacts.github, "profile.contacts.github", "https:"))}">GitHub</a>`,
    `<a href="${escapeHtmlAttribute(safeDestinationUrl(contacts.linkedin, "profile.contacts.linkedin", "https:"))}">LinkedIn</a>`,
    `<a href="${escapeHtmlAttribute(safeDestinationUrl(contacts.email, "profile.contacts.email", "mailto:"))}">Email</a>`,
  ].join(" · ");

  return [
    "<hr>",
    "<p><strong>04 / CONTACT</strong></p>",
    "<h2>Contact</h2>",
    `<p><strong>${links}</strong></p>`,
  ].join("\n\n");
}

function escapeMarkdownLabel(value) {
  return escapeMarkdown(value);
}

function escapeMarkdownParagraph(value) {
  return escapeMarkdown(value);
}

function escapeMarkdown(value) {
  const numberedListMatch = value.match(/^\d+\.(?=\s)/u);
  const numberedListPeriod = numberedListMatch
    ? numberedListMatch[0].length - 1
    : -1;
  const markerLine = isMarkdownMarkerLine(value);
  const autolinkPunctuation = findAutolinkPunctuation(value);
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const shouldEscape =
      MARKDOWN_ESCAPABLE_CHARACTERS.has(character) ||
      (index === 0 && "#-+".includes(character)) ||
      (index === numberedListPeriod && character === ".") ||
      (markerLine && /[-=]/u.test(character)) ||
      autolinkPunctuation.has(index);

    if (character === "&") {
      output += "&amp;";
    } else if (shouldEscape) {
      output += `\\${character}`;
    } else {
      output += character;
    }
  }

  return output;
}

function isMarkdownMarkerLine(value) {
  const compact = value.replaceAll(/\s/gu, "");
  return (
    compact.length >= 3 &&
    /^(?:-+|=+)$|^\*+$|^_+$/u.test(compact)
  );
}

function findAutolinkPunctuation(value) {
  const punctuation = new Set();
  const patterns = [
    /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>()]+/giu,
    /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/giu,
  ];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const start = match.index ?? 0;
      for (let offset = 0; offset < match[0].length; offset += 1) {
        if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/u.test(match[0][offset])) {
          punctuation.add(start + offset);
        }
      }
    }
  }

  return punctuation;
}

function escapeHtmlAttribute(value) {
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new TypeError("HTML attribute must not contain control characters");
  }

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlText(value) {
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new TypeError("HTML text must not contain control characters");
  }

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeDestinationUrl(value, path, protocol) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${path} must be a validated ${protocol} destination`);
  }

  if (
    url.protocol !== protocol ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    CONTROL_CHARACTER_PATTERN.test(url.href) ||
    /[<>]/u.test(url.href)
  ) {
    throw new TypeError(`${path} must be a validated ${protocol} destination`);
  }

  return url.href;
}
