import { getAdjacentSkills, getDemandByYoe } from "./benchmarkContext.js";
import {
  getCatalogEntriesForSkill,
  getLearningProfile,
} from "./learningData.js";
import { buildSkillPriorityRanking } from "./skillPriorityEngine.js";
import { normalizeSkill } from "./normaliseSkills.js";

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function candidateLevelFromYears(resumeYears) {
  if (!Number.isFinite(resumeYears)) return "beginner";
  if (resumeYears < 2) return "beginner";
  if (resumeYears < 5) return "intermediate";
  return "advanced";
}

function levelScore(itemLevel, resumeYears, targetLevel) {
  const candidateLevel = candidateLevelFromYears(resumeYears);
  const weights = { beginner: 1, intermediate: 2, advanced: 3 };
  const itemWeight = weights[itemLevel] || 2;
  const candidateWeight = weights[candidateLevel] || 1;
  const targetWeight = weights[targetLevel] || 2;

  const candidateFit = Math.max(50, 100 - Math.abs(itemWeight - candidateWeight) * 20);
  const targetFit = Math.max(45, 100 - Math.abs(itemWeight - targetWeight) * 20);
  return Math.round(candidateFit * 0.45 + targetFit * 0.55);
}

function formatPriorityLabel(score) {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

function buildItemReasons({ skillEvidence, item, levelFitScore, catalogMatchScore }) {
  const reasons = [
    `${skillEvidence.skill} has a priority score of ${skillEvidence.priorityScore} based on role need and market demand.`,
    `${item.title} directly supports ${skillEvidence.skill} and closely matches the candidate's current readiness.`,
  ];

  if (levelFitScore >= 75) {
    reasons.push(`The learning level is aligned with the candidate's current experience band.`);
  }
  if (item.hands_on_score >= 80) {
    reasons.push(`This option has a strong hands-on component, which improves portfolio readiness.`);
  }
  if (catalogMatchScore < 100) {
    reasons.push(`This item also reinforces adjacent skills needed with ${skillEvidence.skill}.`);
  }

  return reasons.slice(0, 4);
}

function scoreCatalogItem({ item, skillEvidence, resumeYears }) {
  const catalogMatchScore = item.skills_covered.includes(skillEvidence.skill)
    ? 100
    : 70;
  const levelFitScore = levelScore(item.level, resumeYears, skillEvidence.targetLevel);
  const priorityScore = Math.round(
    skillEvidence.priorityScore * 0.45 +
      levelFitScore * 0.2 +
      item.provider_trust_score * 0.15 +
      item.hands_on_score * 0.1 +
      catalogMatchScore * 0.1
  );

  return {
    itemScore: Math.min(priorityScore, 100),
    levelFitScore,
    catalogMatchScore,
  };
}

function flattenUnique(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.course_id)) return false;
    seen.add(item.course_id);
    return true;
  });
}

function allocatePhase(item, learningProfile, skillEvidence, focusSkill) {
  if (item.format === "project") return "Portfolio / Applied Practice";
  if (
    learningProfile.prerequisites.length > 0 &&
    skillEvidence.readinessScore < 60
  ) {
    return "Foundation";
  }
  if (focusSkill && focusSkill === skillEvidence.skill) {
    return "Core Role Alignment";
  }
  if (skillEvidence.priorityScore >= 70) {
    return "Core Role Alignment";
  }
  return "Foundation";
}

function buildPhaseCollection(name, items = []) {
  return {
    name,
    items: flattenUnique(items).sort((a, b) => b.priorityScore - a.priorityScore),
  };
}

export function buildEvidenceBackedRoadmap({
  resumeCanonicalSkills = [],
  resumeYears = null,
  targetCanonicalSkills = [],
  missingCanonicalSkills = [],
  targetYoeMin = 0,
  targetYoeMax = null,
  targetTitleCandidates = [],
  focusSkill = null,
}) {
  const priorityModel = buildSkillPriorityRanking({
    missingCanonicalSkills,
    targetCanonicalSkills,
    resumeCanonicalSkills,
    resumeYears,
    targetYoeMin,
    targetYoeMax,
    targetTitleCandidates,
    focusSkill,
  });

  const activeSkill = normalizeSkill(
    focusSkill || priorityModel.summary.highestImpactMissingSkill || ""
  );

  const phaseBuckets = {
    Foundation: [],
    "Core Role Alignment": [],
    "Portfolio / Applied Practice": [],
  };

  const enrichedItems = [];

  priorityModel.ranking.slice(0, 5).forEach((skillEvidence) => {
    const learningProfile = getLearningProfile(skillEvidence.skill);
    const catalogEntries = getCatalogEntriesForSkill(skillEvidence.skill)
      .map((item) => {
        const scoring = scoreCatalogItem({
          item,
          skillEvidence,
          resumeYears,
        });

        return {
          ...item,
          targetSkill: skillEvidence.skill,
          priorityScore: scoring.itemScore,
          priorityLabel: formatPriorityLabel(scoring.itemScore),
          selectedBecause: buildItemReasons({
            skillEvidence,
            item,
            levelFitScore: scoring.levelFitScore,
            catalogMatchScore: scoring.catalogMatchScore,
          }),
          marketDemandScore: skillEvidence.marketDemandScore,
          targetRoleNeedScore: skillEvidence.targetRoleNeedScore,
          experienceFitScore: scoring.levelFitScore,
          readinessScore: skillEvidence.readinessScore,
          effortInverseScore: skillEvidence.effortInverseScore,
          sourceDataset: item.source_type || "course_catalog",
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 3);

    catalogEntries.forEach((entry) => {
      const phase = allocatePhase(entry, learningProfile, skillEvidence, activeSkill);
      phaseBuckets[phase].push(entry);
      enrichedItems.push(entry);
    });
  });

  const phases = [
    buildPhaseCollection("Foundation", phaseBuckets.Foundation),
    buildPhaseCollection("Core Role Alignment", phaseBuckets["Core Role Alignment"]),
    buildPhaseCollection("Portfolio / Applied Practice", phaseBuckets["Portfolio / Applied Practice"]),
  ].filter((phase) => phase.items.length);

  const uniqueItems = flattenUnique(enrichedItems).sort((a, b) => b.priorityScore - a.priorityScore);
  const courses = uniqueItems.filter((item) => item.format === "course").slice(0, 6);
  const resources = uniqueItems.filter((item) => item.format === "docs" || item.format === "video").slice(0, 6);
  const projects = uniqueItems.filter((item) => item.format === "project").slice(0, 6);

  const timelineWeeks = Math.max(
    2,
    Math.round(
      average(uniqueItems.slice(0, 6).map((item) => item.estimated_weeks || 0)) +
        Math.max(0, uniqueItems.slice(0, 6).length - 2)
    )
  );

  return {
    version: "roadmap-v2",
    catalogSource: "course_catalog",
    focusSkill: activeSkill || null,
    timelineWeeks: String(timelineWeeks),
    phases,
    courses,
    projects,
    resources,
    priorityRanking: priorityModel.ranking,
    selectedSkillInsights: activeSkill
      ? {
          skill: activeSkill,
          demandByYoe: getDemandByYoe(activeSkill),
          skillAdjacency: getAdjacentSkills(activeSkill, 8),
          learningProfile: getLearningProfile(activeSkill),
        }
      : {
          skill: null,
          demandByYoe: [],
          skillAdjacency: [],
          learningProfile: null,
        },
    methodology: {
      version: "roadmap-v2",
      formula:
        "Skill priority = 0.35 target role need + 0.25 market demand + 0.15 target YOE demand + 0.15 readiness + 0.10 effort inverse",
      planner:
        "Roadmap items are selected from a curated catalog and ranked deterministically using skill priority, level fit, provider trust, and hands-on value.",
    },
  };
}
