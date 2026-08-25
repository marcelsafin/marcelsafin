const PROFILE_KEYS = [
  "username",
  "identity",
  "story",
  "education",
  "howIBuild",
  "openSource",
  "currentlyExploring",
  "longTermQuestions",
  "contacts",
];

const IDENTITY_KEYS = ["eyebrow", "headline", "intro"];
const STORY_KEYS = ["period", "heading", "paragraphs"];
const EDUCATION_KEYS = ["program", "yhPoints", "areas"];
const HOW_I_BUILD_KEYS = ["intro", "capabilities"];
const OPEN_SOURCE_KEYS = ["label", "url", "signal"];
const CONTACT_KEYS = ["github", "linkedin", "email"];
const STORY_PERIODS = ["LATE 2023", "2024", "2025", "NOW"];
const APPROVED_OPEN_SOURCE_LABEL = "Contributor to github/spec-kit";
const APPROVED_OPEN_SOURCE_URL = "https://github.com/github/spec-kit";
const APPROVED_OPEN_SOURCE_SIGNAL = "40+ commits";
const APPROVED_CAPABILITIES = new Set([
  "Problem definition",
  "Product direction",
  "Agent direction",
  "Debugging",
  "Model and tool selection",
  "Deployment",
  "UX",
]);
const MAILBOX_PATTERN =
  /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u;

export function validateProfileConfig(value) {
  assertRecord(value, "profile");
  assertExactKeys(value, PROFILE_KEYS, "profile");

  assertGithubUsername(value.username, "profile.username");
  assertIdentity(value.identity);
  assertStory(value.story);
  assertEducation(value.education);
  assertHowIBuild(value.howIBuild);
  const openSourceUrl = assertOpenSource(value.openSource);
  assertStringArray(
    value.currentlyExploring,
    "profile.currentlyExploring",
    1,
    6,
    80,
  );
  assertStringArray(
    value.longTermQuestions,
    "profile.longTermQuestions",
    1,
    6,
    80,
  );
  assertContacts(value.contacts, value.username);

  const result = structuredClone(value);
  result.openSource.url = openSourceUrl;
  return result;
}

function assertIdentity(value) {
  const path = "profile.identity";
  assertRecord(value, path);
  assertExactKeys(value, IDENTITY_KEYS, path);
  assertFreeText(value.eyebrow, `${path}.eyebrow`, 40);
  assertFreeText(value.headline, `${path}.headline`, 100);
  assertStringArray(value.intro, `${path}.intro`, 1, 3, 240);
}

function assertStory(value) {
  const path = "profile.story";
  assertArray(value, path);
  if (value.length !== STORY_PERIODS.length) {
    throw new TypeError(`${path} must contain exactly 4 items`);
  }

  value.forEach((chapter, index) => {
    const chapterPath = `${path}[${index}]`;
    assertRecord(chapter, chapterPath);
    assertExactKeys(chapter, STORY_KEYS, chapterPath);
    assertString(chapter.period, `${chapterPath}.period`, 20);

    if (chapter.period !== STORY_PERIODS[index]) {
      throw new TypeError(
        `${chapterPath}.period must equal "${STORY_PERIODS[index]}"`,
      );
    }
    assertFreeText(chapter.heading, `${chapterPath}.heading`, 120);
    assertStringArray(
      chapter.paragraphs,
      `${chapterPath}.paragraphs`,
      1,
      4,
      360,
    );
  });
}

function assertEducation(value) {
  const path = "profile.education";
  assertRecord(value, path);
  assertExactKeys(value, EDUCATION_KEYS, path);
  assertFreeText(value.program, `${path}.program`, 80);

  if (
    !Number.isSafeInteger(value.yhPoints) ||
    value.yhPoints < 1 ||
    value.yhPoints > 1000
  ) {
    throw new TypeError(
      `${path}.yhPoints must be a safe integer between 1 and 1000`,
    );
  }

  assertStringArray(value.areas, `${path}.areas`, 5, 10, 80);
}

function assertHowIBuild(value) {
  const path = "profile.howIBuild";
  assertRecord(value, path);
  assertExactKeys(value, HOW_I_BUILD_KEYS, path);
  assertFreeText(value.intro, `${path}.intro`, 240);
  assertArray(value.capabilities, `${path}.capabilities`);

  value.capabilities.forEach((capability, index) => {
    const capabilityPath = `${path}.capabilities[${index}]`;
    assertFreeText(capability, capabilityPath, 80);
    if (!APPROVED_CAPABILITIES.has(capability)) {
      throw new TypeError(
        `${capabilityPath} is not an approved capability`,
      );
    }
  });

  assertArrayLength(value.capabilities, `${path}.capabilities`, 1, 7);

  const seen = new Set();
  value.capabilities.forEach((capability) => {
    if (seen.has(capability)) {
      throw new TypeError(
        `${path}.capabilities must contain unique items`,
      );
    }
    seen.add(capability);
  });
}

function assertOpenSource(value) {
  const path = "profile.openSource";
  assertRecord(value, path);
  assertExactKeys(value, OPEN_SOURCE_KEYS, path);
  assertFreeText(value.label, `${path}.label`, 100);
  assertString(value.url, `${path}.url`, 240);
  assertFreeText(value.signal, `${path}.signal`, 40);

  if (value.label !== APPROVED_OPEN_SOURCE_LABEL) {
    throw new TypeError(
      `${path}.label must equal "${APPROVED_OPEN_SOURCE_LABEL}"`,
    );
  }
  if (value.signal !== APPROVED_OPEN_SOURCE_SIGNAL) {
    throw new TypeError(
      `${path}.signal must equal "${APPROVED_OPEN_SOURCE_SIGNAL}"`,
    );
  }

  assertHttpsUrl(value.url, `${path}.url`, 240);
  if (
    value.url !== APPROVED_OPEN_SOURCE_URL &&
    value.url !== `${APPROVED_OPEN_SOURCE_URL}/`
  ) {
    throw new TypeError(
      `${path}.url must equal "${APPROVED_OPEN_SOURCE_URL}"`,
    );
  }

  return APPROVED_OPEN_SOURCE_URL;
}

function assertContacts(value, username) {
  const path = "profile.contacts";
  assertRecord(value, path);
  assertExactKeys(value, CONTACT_KEYS, path);
  assertGithubProfile(value.github, username, `${path}.github`);
  assertLinkedin(value.linkedin, `${path}.linkedin`);
  assertMailto(value.email, `${path}.email`);
}

function assertRecord(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be a non-null object that is not an array`);
  }
}

function assertExactKeys(value, expectedKeys, path) {
  const expected = new Set(expectedKeys);

  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      throw new TypeError(`${path}: unknown key "${key}"`);
    }
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      throw new TypeError(`${path}: missing key "${key}"`);
    }
  }
}

function assertString(value, path, maxLength) {
  if (typeof value !== "string") {
    throw new TypeError(`${path} must be a string`);
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new TypeError(`${path} must not contain control characters`);
  }
  if (value.length === 0 || value.trim().length === 0) {
    throw new TypeError(
      `${path} must contain at least 1 non-whitespace character`,
    );
  }
  if (value !== value.trim()) {
    throw new TypeError(`${path} must not have surrounding whitespace`);
  }
  if (value.length > maxLength) {
    throw new TypeError(`${path} must be at most ${maxLength} characters`);
  }
}

function assertFreeText(value, path, maxLength) {
  assertString(value, path, maxLength);

  if (value.includes("@")) {
    throw new TypeError(
      `${path} mentions/email-like tokens are not allowed`,
    );
  }
}

function assertGithubUsername(value, path) {
  assertString(value, path, 39);

  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(value) ||
    value.includes("--")
  ) {
    throw new TypeError(
      `${path} must be a valid GitHub username with 1-39 ASCII letters, digits, or hyphens`,
    );
  }
}

function assertArray(value, path) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array`);
  }
}

function assertArrayLength(value, path, min, max) {
  if (value.length < min || value.length > max) {
    throw new TypeError(`${path} must contain between ${min} and ${max} items`);
  }
}

function assertStringArray(value, path, min, max, itemMaxLength) {
  assertArray(value, path);
  assertArrayLength(value, path, min, max);
  value.forEach((item, index) => {
    assertFreeText(item, `${path}[${index}]`, itemMaxLength);
  });
}

function assertGithubProfile(value, username, path) {
  const url = assertHttpsUrl(value, path, 240);

  if (!["github.com", "www.github.com"].includes(url.hostname)) {
    throw new TypeError(`${path} must use hostname github.com or www.github.com`);
  }

  const pathname = url.pathname.replace(/\/+$/u, "");
  if (pathname.toLowerCase() !== `/${username.toLowerCase()}`) {
    throw new TypeError(`${path} must point to the configured GitHub profile`);
  }
}

function assertLinkedin(value, path) {
  const url = assertHttpsUrl(value, path, 240);

  if (!["linkedin.com", "www.linkedin.com"].includes(url.hostname)) {
    throw new TypeError(
      `${path} must use hostname linkedin.com or www.linkedin.com`,
    );
  }

  if (!/^\/in\/[^/]+\/?$/u.test(url.pathname)) {
    throw new TypeError(`${path} must point to a LinkedIn profile`);
  }
}

function assertMailto(value, path) {
  assertString(value, path, 240);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${path} must contain one valid mailbox`);
  }

  if (
    url.protocol !== "mailto:" ||
    url.username ||
    url.password ||
    url.hostname ||
    url.port ||
    url.search ||
    url.hash ||
    value.slice(value.indexOf(":") + 1).startsWith("//")
  ) {
    throw new TypeError(`${path} must contain one valid mailbox`);
  }

  let mailbox;
  try {
    mailbox = decodeURIComponent(value.slice(value.indexOf(":") + 1));
  } catch {
    throw new TypeError(`${path} must contain one valid mailbox`);
  }

  if (
    CONTROL_CHARACTER_PATTERN.test(mailbox) ||
    !MAILBOX_PATTERN.test(mailbox)
  ) {
    throw new TypeError(`${path} must contain one valid mailbox`);
  }
}

function assertHttpsUrl(value, path, maxLength) {
  assertString(value, path, maxLength);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${path} must be a valid HTTPS URL`);
  }

  if (url.protocol !== "https:") {
    throw new TypeError(`${path} must use https:`);
  }

  if (
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(`${path} must be a valid HTTPS URL`);
  }

  try {
    if (CONTROL_CHARACTER_PATTERN.test(decodeURIComponent(url.pathname))) {
      throw new TypeError(`${path} must not contain control characters`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("control characters")) {
      throw error;
    }
    throw new TypeError(`${path} must be a valid HTTPS URL`);
  }

  return url;
}
