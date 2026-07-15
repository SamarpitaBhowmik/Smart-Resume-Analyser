import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeSkill } from "./normaliseSkills.js";
import { readCourseCatalogFromDisk } from "./datasetPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COURSE_CATALOG_PATH = path.resolve(__dirname, "../data/courseCatalog.json");
const SKILL_LEARNING_MAP_PATH = path.resolve(__dirname, "../data/skillLearningMap.json");

let cachedCatalog = null;
let cachedSkillMap = null;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeCatalogEntry(entry) {
  return {
    ...entry,
    skills_covered: (entry.skills_covered || []).map((skill) => normalizeSkill(skill)).filter(Boolean),
    prerequisites: (entry.prerequisites || []).map((skill) => normalizeSkill(skill)).filter(Boolean),
  };
}

export function getCourseCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const processedCatalog = readCourseCatalogFromDisk();
  const catalogSource = processedCatalog?.length ? processedCatalog : readJson(COURSE_CATALOG_PATH);
  cachedCatalog = catalogSource.map(normalizeCatalogEntry);
  return cachedCatalog;
}

export function getSkillLearningMap() {
  if (cachedSkillMap) return cachedSkillMap;

  const rawMap = readJson(SKILL_LEARNING_MAP_PATH);
  cachedSkillMap = Object.fromEntries(
    Object.entries(rawMap).map(([skill, config]) => [
      normalizeSkill(skill),
      {
        ...config,
        prerequisites: (config.prerequisites || []).map((item) => normalizeSkill(item)).filter(Boolean),
        adjacent_skills: (config.adjacent_skills || []).map((item) => normalizeSkill(item)).filter(Boolean),
      },
    ])
  );

  return cachedSkillMap;
}

export function inferSkillCategory(skill = "") {
  const normalized = normalizeSkill(skill);
  const map = getSkillLearningMap();
  if (map[normalized]?.category) return map[normalized].category;

  if (/(communication|leadership|team|project management|collaboration|problem-solving|adaptability|creativity)/i.test(normalized)) {
    return "professional";
  }
  if (/(aws|azure|google cloud platform|kubernetes|docker|ci\/cd|linux|terraform|devops)/i.test(normalized)) {
    return "cloud";
  }
  if (/(figma|design|ux|ui)/i.test(normalized)) {
    return "design";
  }
  if (/(sql|tableau|power bi|data|tensorflow|pytorch|machine learning|python)/i.test(normalized)) {
    return "data";
  }

  return "technical";
}

function createFallbackEntries(skill, mapConfig = {}) {
  const normalizedSkill = normalizeSkill(skill);
  const category = mapConfig.category || inferSkillCategory(normalizedSkill);
  const prerequisites = mapConfig.prerequisites || [];
  const effort = mapConfig.default_effort_weeks || 3;

  const courseByCategory = {
    technical: {
      provider: "Microsoft Learn Search",
      url: `https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(normalizedSkill)}`,
    },
    data: {
      provider: "Kaggle Learn",
      url: "https://www.kaggle.com/learn",
    },
    cloud: {
      provider: "Microsoft Learn Search",
      url: `https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(normalizedSkill)}`,
    },
    design: {
      provider: "Figma Help Center",
      url: "https://help.figma.com/hc/en-us/categories/360002051613",
    },
    professional: {
      provider: "Coursera Search",
      url: `https://www.coursera.org/search?query=${encodeURIComponent(normalizedSkill)}`,
    },
  };

  const providerInfo = courseByCategory[category] || courseByCategory.technical;

  return [
    normalizeCatalogEntry({
      course_id: `fallback-course-${normalizedSkill.replace(/[^a-z0-9]+/g, "-")}`,
      title: `Targeted Learning Track for ${normalizedSkill}`,
      provider: providerInfo.provider,
      url: providerInfo.url,
      skills_covered: [normalizedSkill],
      level: "intermediate",
      estimated_hours: effort * 6,
      estimated_weeks: effort,
      format: "course",
      provider_trust_score: 78,
      hands_on_score: 60,
      cost_type: category === "professional" ? "mixed" : "free",
      prerequisites,
      last_reviewed: "2026-04-02",
      source_type: "fallback-template",
    }),
    normalizeCatalogEntry({
      course_id: `fallback-project-${normalizedSkill.replace(/[^a-z0-9]+/g, "-")}`,
      title: `Practice Brief for ${normalizedSkill}`,
      provider: "CareerAlign Project Brief",
      url: `local://project/${normalizedSkill.replace(/[^a-z0-9]+/g, "-")}-practice`,
      skills_covered: [normalizedSkill, ...(mapConfig.adjacent_skills || []).slice(0, 2)],
      level: "intermediate",
      estimated_hours: effort * 8,
      estimated_weeks: effort,
      format: "project",
      provider_trust_score: 86,
      hands_on_score: 92,
      cost_type: "free",
      prerequisites,
      last_reviewed: "2026-04-02",
      source_type: "fallback-template",
    }),
  ];
}

export function getCatalogEntriesForSkill(skill = "") {
  const normalizedSkill = normalizeSkill(skill);
  const catalog = getCourseCatalog();
  const entries = catalog.filter((entry) => entry.skills_covered.includes(normalizedSkill));

  if (entries.length) return entries;

  const learningMap = getSkillLearningMap();
  return createFallbackEntries(normalizedSkill, learningMap[normalizedSkill] || {});
}

export function getLearningProfile(skill = "") {
  const normalizedSkill = normalizeSkill(skill);
  const learningMap = getSkillLearningMap();

  return (
    learningMap[normalizedSkill] || {
      category: inferSkillCategory(normalizedSkill),
      prerequisites: [],
      adjacent_skills: [],
      recommended_formats: ["course", "project"],
      target_level_by_yoe: {
        entry: "beginner",
        mid: "intermediate",
        senior: "advanced",
      },
      recommended_projects: [`Build a focused portfolio artifact around ${normalizedSkill}`],
      default_effort_weeks: 3,
    }
  );
}
