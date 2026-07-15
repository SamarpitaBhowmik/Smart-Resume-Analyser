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

function lineContainsSkill(normLine, normSkill) {
  if (normLine.includes(` ${normSkill} `)) return true;
  for (const [alias, canonical] of Object.entries(skillAliasMap)) {
    if (normalizeSkill(canonical) === normSkill) {
      const normAlias = normalizeTextForMatching(alias).trim();
      if (normLine.includes(` ${normAlias} `)) return true;
    }
  }
  return false;
}

export function analyzeJDContexts(jobDescription = "", canonicalSkills = []) {
  const lines = String(jobDescription || "").split(/\r?\n/);
  const skillContexts = {};

  // Initialize all canonical skills with default general context
  canonicalSkills.forEach((skill) => {
    skillContexts[skill] = {
      context: "general",
      weight: 1.0,
      explicitlyEmphasized: false,
      section: "general",
    };
  });

  const reqHeaders = /^\s*(requirements|qualifications|what you need|minimum qualifications|basic qualifications|skills required|critical skills|core competencies|required skills|education|experience|credentials)/i;
  const prefHeaders = /^\s*(preferred qualifications|preferred skills|nice to have|pluses|bonus|highly desired|preferred|preferred experience|desirable)/i;
  const respHeaders = /^\s*(responsibilities|what you will do|key responsibilities|duties|role|essential duties|job description|tasks|day-to-day)/i;
  const otherHeaders = /^\s*(about us|company profile|benefits|perks|compensation|equal opportunity)/i;

  const reqKeywords = /\b(required|must|essential|critical|mandatory|minimum|necessity|necessities|qualification|qualifications|need|needs|expected to have|proficient in|expertise in|experience with|years of|critical|core|key skill)\b/i;
  const prefKeywords = /\b(preferred|nice-to-have|nice to have|plus|pluses|bonus|desirable|optional|good to have|ideal|advantage|helpful|preference|desired)\b/i;
  const respKeywords = /\b(responsibilities|responsible|will do|will be|duties|task|tasks|manage|lead|build|develop|maintain|collaborate|work with|deliver|implement)\b/i;

  let currentSection = "general";

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect section header
    if (
      trimmed.length < 60 &&
      (trimmed.endsWith(":") ||
        reqHeaders.test(trimmed) ||
        prefHeaders.test(trimmed) ||
        respHeaders.test(trimmed) ||
        otherHeaders.test(trimmed))
    ) {
      if (reqHeaders.test(trimmed)) {
        currentSection = "required";
      } else if (prefHeaders.test(trimmed)) {
        currentSection = "preferred";
      } else if (respHeaders.test(trimmed)) {
        currentSection = "responsibilities";
      } else if (otherHeaders.test(trimmed)) {
        currentSection = "other";
      }
    }

    // Split line into clauses
    const sentences = trimmed.split(/(?<=[.?!])\s+/);
    sentences.forEach((sentence) => {
      const normSentence = normalizeTextForMatching(sentence);

      canonicalSkills.forEach((skill) => {
        if (lineContainsSkill(normSentence, skill)) {
          let score = 1.0;
          let context = "general";

          if (currentSection === "required") {
            score = 3.0;
            context = "required";
          } else if (currentSection === "responsibilities") {
            score = 2.5;
            context = "responsibilities";
          } else if (currentSection === "preferred") {
            score = 1.5;
            context = "preferred";
          } else if (currentSection === "other") {
            score = 0.5;
            context = "other";
          } else {
            // Sentence content matching
            if (reqKeywords.test(normSentence)) {
              score = 3.0;
              context = "required";
            } else if (respKeywords.test(normSentence)) {
              score = 2.5;
              context = "responsibilities";
            } else if (prefKeywords.test(normSentence)) {
              score = 1.5;
              context = "preferred";
            } else {
              score = 2.0;
              context = "general";
            }
          }

          // Check for explicit emphasis
          let explicitlyEmphasized = false;
          if (
            /\b(strongly|strongly preferred|highly desired|deep understanding|expert|expertise|years of experience|extensive|proven track record|essential|primary|core)\b/i.test(
              normSentence
            )
          ) {
            explicitlyEmphasized = true;
            score += 0.5;
          }

          if (score > (skillContexts[skill]?.weight || 0)) {
            skillContexts[skill] = {
              context,
              weight: score,
              explicitlyEmphasized,
              section: currentSection,
            };
          }
        }
      });
    });
  });

  return skillContexts;
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

  const skillsContext = analyzeJDContexts(jobDescription, canonicalSkills);

  return {
    skills: canonicalSkills.map((skill) => formatSkillLabel(skill)),
    canonicalSkills,
    skillsContext,
    titleCandidates: titleCandidates.map((item) => item.normalizedTitle),
    extractionConfidence,
    extractionMethod,
    usedGeminiFallback,
  };
}
