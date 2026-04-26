import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getBenchmarkContext } from "./benchmarkContext.js";
import { normalizeSkill, normalizeTitle } from "./normaliseSkills.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillAliasMap = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../data/skillAliasMap.json"), "utf8")
);

function normalizeTextForMatching(text = "") {
  return ` ${String(text)
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[_/,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function formatSkillLabel(skill = "") {
  return String(skill)
    .split(/[\s/]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildKnownSkillTerms() {
  const context = getBenchmarkContext();
  const terms = new Map();

  Object.entries(skillAliasMap).forEach(([alias, canonical]) => {
    const normalizedCanonical = normalizeSkill(canonical);
    terms.set(normalizeTextForMatching(alias).trim(), normalizedCanonical);
  });

  Array.from(context.knownSkills).forEach((skill) => {
    terms.set(normalizeTextForMatching(skill).trim(), normalizeSkill(skill));
  });

  return terms;
}

function extractDeterministicSkills(jobDescription = "") {
  const knownTerms = buildKnownSkillTerms();
  const haystack = normalizeTextForMatching(jobDescription);
  const foundSkills = new Set();

  Array.from(knownTerms.entries())
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([term, canonical]) => {
      if (!term) return;
      if (haystack.includes(` ${term} `)) {
        foundSkills.add(canonical);
      }
    });

  return Array.from(foundSkills);
}

function extractTitleCandidates(jobDescription = "") {
  const context = getBenchmarkContext();
  const haystack = normalizeTextForMatching(jobDescription);
  const descriptionTokens = new Set(normalizeTitle(jobDescription).split(" ").filter(Boolean));

  return context.knownTitles
    .map((title) => {
      const normalizedTitle = normalizeTitle(title);
      const titleTokens = normalizedTitle.split(" ").filter(Boolean);
      const overlap = titleTokens.filter((token) => descriptionTokens.has(token)).length;
      const directMatch = haystack.includes(` ${normalizedTitle} `) ? 1 : 0;
      const score = directMatch * 0.7 + (titleTokens.length ? overlap / titleTokens.length : 0) * 0.3;
      return {
        normalizedTitle,
        score,
      };
    })
    .filter((item) => item.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function computeExtractionConfidence(skills, titleCandidates) {
  return Math.min(95, skills.length * 16 + titleCandidates.length * 8);
}

export async function extractJobRequirements(jobDescription, fallbackExtractor = null) {
  const deterministicSkills = extractDeterministicSkills(jobDescription);
  const titleCandidates = extractTitleCandidates(jobDescription);
  let canonicalSkills = [...deterministicSkills];
  let usedGeminiFallback = false;
  let extractionMethod = "deterministic";
  let extractionConfidence = computeExtractionConfidence(canonicalSkills, titleCandidates);

  if ((canonicalSkills.length < 2 || extractionConfidence < 45) && typeof fallbackExtractor === "function") {
    try {
      const fallbackSkills = await fallbackExtractor(jobDescription);
      const merged = new Set(canonicalSkills);
      (fallbackSkills || []).forEach((skill) => merged.add(normalizeSkill(skill)));
      canonicalSkills = Array.from(merged).filter(Boolean);
      usedGeminiFallback = true;
      extractionMethod = "deterministic+gemini-fallback";
      extractionConfidence = Math.min(92, computeExtractionConfidence(canonicalSkills, titleCandidates) + 15);
    } catch (error) {
      extractionMethod = "deterministic-fallback-failed";
    }
  }

  return {
    skills: canonicalSkills.map((skill) => formatSkillLabel(skill)),
    canonicalSkills,
    titleCandidates: titleCandidates.map((item) => item.normalizedTitle),
    extractionConfidence,
    extractionMethod,
    usedGeminiFallback,
  };
}
