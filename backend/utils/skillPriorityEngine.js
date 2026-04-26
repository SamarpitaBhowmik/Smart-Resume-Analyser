import {
  findRelevantRoles,
  getAdjacentSkills,
  getDemandByYoe,
  getExpectedSkillYoe,
  getGlobalSkillDemandScore,
  getNearestYoeBand,
  getRoleNeedScore,
} from "./benchmarkContext.js";
import { getLearningProfile } from "./learningData.js";
import { normalizeSkill } from "./normaliseSkills.js";

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateCandidateLevel(years) {
  if (!Number.isFinite(years)) return "beginner";
  if (years < 2) return "beginner";
  if (years < 5) return "intermediate";
  return "advanced";
}

function levelToWeight(level = "beginner") {
  if (level === "advanced") return 3;
  if (level === "intermediate") return 2;
  return 1;
}

function inferTargetLevel(skill, targetYoeYears) {
  const learningProfile = getLearningProfile(skill);
  if (!Number.isFinite(targetYoeYears) || targetYoeYears < 2) {
    return learningProfile.target_level_by_yoe?.entry || "beginner";
  }
  if (targetYoeYears < 5) {
    return learningProfile.target_level_by_yoe?.mid || "intermediate";
  }
  return learningProfile.target_level_by_yoe?.senior || "advanced";
}

function computeReadinessScore(skill, resumeCanonicalSkills, resumeYears) {
  const learningProfile = getLearningProfile(skill);
  const prerequisites = learningProfile.prerequisites || [];
  const adjacentSkills = learningProfile.adjacent_skills || [];

  const prerequisiteCoverage = prerequisites.length
    ? (prerequisites.filter((item) => resumeCanonicalSkills.has(item)).length / prerequisites.length) * 100
    : 80;
  const adjacentCoverage = adjacentSkills.length
    ? (adjacentSkills.filter((item) => resumeCanonicalSkills.has(item)).length / adjacentSkills.length) * 100
    : 70;

  const candidateLevel = levelToWeight(estimateCandidateLevel(resumeYears));
  const targetLevel = levelToWeight(inferTargetLevel(skill, resumeYears));
  const levelReadiness = Math.max(35, 100 - Math.max(0, targetLevel - candidateLevel) * 20);

  return {
    score: Math.round(prerequisiteCoverage * 0.5 + adjacentCoverage * 0.2 + levelReadiness * 0.3),
    prerequisiteCoverage: Math.round(prerequisiteCoverage),
    adjacentCoverage: Math.round(adjacentCoverage),
    targetLevel: inferTargetLevel(skill, resumeYears),
  };
}

function computeEffortInverse(skill) {
  const learningProfile = getLearningProfile(skill);
  const defaultEffortWeeks = learningProfile.default_effort_weeks || 3;
  return {
    score: Math.max(30, Math.round(100 - (defaultEffortWeeks - 1) * 15)),
    estimatedWeeks: defaultEffortWeeks,
  };
}

function buildPriorityReason({
  skill,
  roleNeedScore,
  marketDemandScore,
  targetYoeDemandScore,
  readiness,
  effort,
  focusBoost,
  relevantRoles,
}) {
  const reasons = [];

  if (roleNeedScore >= 70) {
    reasons.push(`${skill} is strongly tied to the target role benchmark.`);
  }
  if (marketDemandScore >= 70) {
    reasons.push(`${skill} has strong market demand in the benchmark dataset.`);
  }
  if (targetYoeDemandScore >= 65) {
    reasons.push(`${skill} is actively requested in the target experience band.`);
  }
  if (readiness.score >= 65) {
    reasons.push(`The current resume already covers enough prerequisites to learn ${skill} efficiently.`);
  }
  if (effort.score >= 65) {
    reasons.push(`${skill} has a manageable effort-to-impact ratio for the roadmap.`);
  }
  if (focusBoost > 0) {
    reasons.push(`${skill} is currently selected as the focus skill for roadmap prioritization.`);
  }
  if (relevantRoles.length) {
    reasons.push(`Relevant benchmark roles include ${relevantRoles.slice(0, 2).map((role) => role.displayTitle).join(" and ")}.`);
  }

  return reasons.slice(0, 4);
}

export function buildSkillPriorityRanking({
  missingCanonicalSkills = [],
  targetCanonicalSkills = [],
  resumeCanonicalSkills = [],
  resumeYears = null,
  targetYoeMin = 0,
  targetYoeMax = null,
  targetTitleCandidates = [],
  focusSkill = null,
}) {
  const uniqueMissingSkills = [...new Set(missingCanonicalSkills.map((skill) => normalizeSkill(skill)).filter(Boolean))];
  const resumeSkillSet = new Set(resumeCanonicalSkills.map((skill) => normalizeSkill(skill)).filter(Boolean));
  const inferredRoles = findRelevantRoles(targetCanonicalSkills, targetTitleCandidates);
  const roleTitles = inferredRoles.map((role) => role.normalizedTitle);
  const targetYoeYears = Number.isFinite(targetYoeMin)
    ? targetYoeMax == null
      ? targetYoeMin
      : Number(((targetYoeMin + targetYoeMax) / 2).toFixed(1))
    : resumeYears;
  const targetYoeBand = getNearestYoeBand(Number.isFinite(targetYoeYears) ? targetYoeYears : resumeYears);
  const normalizedFocusSkill = focusSkill ? normalizeSkill(focusSkill) : null;

  const ranking = uniqueMissingSkills.map((skill) => {
    const roleNeedScore = targetCanonicalSkills.includes(skill)
      ? Math.max(80, getRoleNeedScore(skill, roleTitles, targetYoeBand))
      : getRoleNeedScore(skill, roleTitles, targetYoeBand);
    const marketDemandScore = getGlobalSkillDemandScore(skill);
    const demandByYoe = getDemandByYoe(skill);
    const targetYoeDemandScore =
      demandByYoe.find((item) => item.yoeRange === targetYoeBand)?.demand > 0
        ? Math.max(
            20,
            Math.round(
              (demandByYoe.find((item) => item.yoeRange === targetYoeBand)?.demand /
                Math.max(...demandByYoe.map((item) => item.demand), 1)) *
                100
            )
          )
        : 15;
    const readiness = computeReadinessScore(skill, resumeSkillSet, resumeYears);
    const effort = computeEffortInverse(skill);
    const expectedSkillYoe = getExpectedSkillYoe(skill, roleTitles, targetYoeBand);
    const focusBoost = normalizedFocusSkill && normalizedFocusSkill === skill ? 12 : 0;

    const priorityScore = Math.round(
      roleNeedScore * 0.35 +
        marketDemandScore * 0.25 +
        targetYoeDemandScore * 0.15 +
        readiness.score * 0.15 +
        effort.score * 0.1 +
        focusBoost
    );

    const adjacentSkills = getAdjacentSkills(skill, 6);
    const reason = buildPriorityReason({
      skill,
      roleNeedScore,
      marketDemandScore,
      targetYoeDemandScore,
      readiness,
      effort,
      focusBoost,
      relevantRoles: inferredRoles,
    });

    return {
      skill,
      priorityScore: Math.min(priorityScore, 100),
      priorityLabel:
        priorityScore >= 75 ? "High" : priorityScore >= 55 ? "Medium" : "Low",
      targetRoleNeedScore: roleNeedScore,
      marketDemandScore,
      targetYoeDemandScore,
      readinessScore: readiness.score,
      prerequisiteCoverageScore: readiness.prerequisiteCoverage,
      adjacentCoverageScore: readiness.adjacentCoverage,
      effortInverseScore: effort.score,
      estimatedWeeks: effort.estimatedWeeks,
      expectedSkillYoe,
      targetLevel: readiness.targetLevel,
      candidateLevel: estimateCandidateLevel(resumeYears),
      adjacentSkills,
      selectedBecause: reason,
    };
  });

  const maxRoleNeed = Math.max(...ranking.map((item) => item.targetRoleNeedScore), 1);
  const normalizedRanking = ranking
    .map((item) => ({
      ...item,
      severityAgainstTargetScore: Math.round((item.targetRoleNeedScore / maxRoleNeed) * 100),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    focusSkill: normalizedFocusSkill,
    targetYoeBand,
    relevantRoles: inferredRoles,
    ranking: normalizedRanking,
    summary: {
      highestImpactMissingSkill: normalizedRanking[0]?.skill || null,
      averagePriorityScore: Math.round(average(normalizedRanking.map((item) => item.priorityScore))),
    },
  };
}
