import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillAliasMap = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../data/skillAliasMap.json"), "utf8")
);

const REMOVE_WORDS = [
  "basics",
  "basic",
  "fundamentals",
  "intro",
  "to",
  "introduction",
  "exposure",
  "awareness",
  "knowledge of",
  "familiarity with",
];

const TITLE_STOPWORDS = new Set([
  "engineer",
  "developer",
  "specialist",
  "analyst",
  "manager",
  "experienced",
  "fresher",
]);

function normalizeWhitespace(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSkill(skill = "") {
  let normalized = normalizeWhitespace(skill);
  REMOVE_WORDS.forEach((word) => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), "");
  });
  normalized = normalized.replace(/\s+/g, " ").trim();
  return skillAliasMap[normalized] || normalized;
}

export function normalizeTitle(title = "") {
  const normalized = normalizeWhitespace(title)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized
    .split(" ")
    .filter(Boolean)
    .filter((token) => !TITLE_STOPWORDS.has(token));

  return tokens.join(" ") || normalized;
}

export function normalizeSkills(skillsValue) {
  if (!skillsValue) return [];

  const source = Array.isArray(skillsValue) ? skillsValue.join(";") : String(skillsValue);

  return [
    ...new Set(
      source
        .split(/[;,]/)
        .map((skill) => normalizeSkill(skill))
        .filter((skill) => skill.length > 1)
    ),
  ];
}

export function canonicalSkillSet(skillsValue) {
  return new Set(normalizeSkills(skillsValue));
}
