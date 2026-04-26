import {
  findRelevantRoles,
  getExpectedSkillYoe,
  getGlobalSkillDemandScore,
  getNearestYoeBand,
  getRoleSupportScore,
} from "./benchmarkContext.js";
import { normalizeSkill, normalizeSkills } from "./normaliseSkills.js";

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDisplaySkill(skill = "") {
  return String(skill)
    .split(/[\s/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function averageOrZero(values = []) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? average(valid) : 0;
}

function candidateLevelLabel(resumeYears) {
  if (!Number.isFinite(resumeYears)) return "beginner";
  if (resumeYears < 2) return "beginner";
  if (resumeYears < 5) return "intermediate";
  return "advanced";
}

export function estimateResumeExperienceYears(experience = []) {
  if (!Array.isArray(experience) || experience.length === 0) return null;

  const durations = experience
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.duration) return item.duration;
      if (item?.date) return item.date;
      return "";
    })
    .filter(Boolean);

  const spans = durations
    .map((duration) => {
      const match = String(duration).match(/(19|20)\d{2}/g);
      if (match && match.length >= 2) {
        const years = match.map((value) => Number.parseInt(value, 10)).sort((a, b) => a - b);
        return Math.max(0, years[years.length - 1] - years[0]);
      }
      const monthSpan = String(duration).match(/(\d+)\s*(?:months|month)/i);
      if (monthSpan) {
        return Number.parseInt(monthSpan[1], 10) / 12;
      }
      const yearSpan = String(duration).match(/(\d+)\s*(?:years|year|yrs|yr)/i);
      if (yearSpan) {
        return Number.parseInt(yearSpan[1], 10);
      }
      return null;
    })
    .filter((value) => Number.isFinite(value));

  if (!spans.length) {
    return experience.length ? Math.min(10, experience.length) : null;
  }

  return Number(average(spans).toFixed(1));
}

export function buildSkillComparison(resumeSkills = [], jobSkills = []) {
  const resumeMap = new Map();
  const jobMap = new Map();

  resumeSkills.forEach((skill) => {
    const normalized = normalizeSkill(skill);
    if (normalized) {
      resumeMap.set(normalized, skill);
    }
  });

  jobSkills.forEach((skill) => {
    const normalized = normalizeSkill(skill);
    if (normalized) {
      jobMap.set(normalized, skill);
    }
  });

  const matchedCanonical = [];
  const missingCanonical = [];
  const semanticMatches = [];

  for (const [canonical, originalJobSkill] of jobMap.entries()) {
    if (resumeMap.has(canonical)) {
      matchedCanonical.push(canonical);
      const resumeSkill = resumeMap.get(canonical);
      if (String(resumeSkill).toLowerCase() !== String(originalJobSkill).toLowerCase()) {
        semanticMatches.push({
          resumeSkill,
          jobSkill: originalJobSkill,
          canonical,
        });
      }
    } else {
      missingCanonical.push(canonical);
    }
  }

  const matchedSkills = matchedCanonical.map((canonical) => jobMap.get(canonical) || toDisplaySkill(canonical));
  const missingSkills = missingCanonical.map((canonical) => jobMap.get(canonical) || toDisplaySkill(canonical));
  const exactSkillCoverageScore = jobMap.size
    ? Math.round((matchedCanonical.length / jobMap.size) * 100)
    : 0;

  return {
    matchedSkills,
    missingSkills,
    semanticMatches,
    matchedCanonical,
    missingCanonical,
    resumeCanonicalSkills: Array.from(resumeMap.keys()),
    jobCanonicalSkills: Array.from(jobMap.keys()),
    exactSkillCoverageScore,
    skillCoverageScore: exactSkillCoverageScore,
  };
}

export function computeExperienceAlignment(resumeYears, yoeMin = 0, yoeMax = null) {
  if (!Number.isFinite(resumeYears)) {
    return {
      score: yoeMin > 0 ? 35 : 60,
      explanation: "Estimated experience could not be extracted reliably, so experience fit was down-weighted.",
    };
  }

  if (!Number.isFinite(yoeMin)) {
    return {
      score: 70,
      explanation: "Role experience requirement is broad, so experience fit used a neutral score.",
    };
  }

  if (yoeMax == null) {
    const score = resumeYears >= yoeMin ? 100 : Math.max(20, 100 - (yoeMin - resumeYears) * 20);
    return {
      score: Math.round(score),
      explanation:
        resumeYears >= yoeMin
          ? `Resume experience meets the ${yoeMin}+ year role expectation.`
          : `Resume experience is below the ${yoeMin}+ year role expectation.`,
    };
  }

  if (resumeYears >= yoeMin && resumeYears <= yoeMax) {
    return {
      score: 100,
      explanation: `Resume experience falls within the target ${yoeMin}-${yoeMax} year range.`,
    };
  }

  if (resumeYears < yoeMin) {
    return {
      score: Math.max(20, Math.round(100 - (yoeMin - resumeYears) * 20)),
      explanation: `Resume experience is below the target ${yoeMin}-${yoeMax} year range.`,
    };
  }

  return {
    score: Math.max(60, Math.round(100 - (resumeYears - yoeMax) * 8)),
    explanation: `Resume experience is above the target ${yoeMin}-${yoeMax} year range but still transferable.`,
  };
}

export function computeSkillLevelFit({
  resumeSkills = [],
  jobSkills = [],
  resumeYears = null,
  roleTitles = [],
  targetYoeLabel = null,
}) {
  const comparison = buildSkillComparison(resumeSkills, jobSkills);
  const evidence = comparison.jobCanonicalSkills.map((skill) => {
    const expectedYoe = getExpectedSkillYoe(skill, roleTitles, targetYoeLabel);
    const marketDemandScore = getGlobalSkillDemandScore(skill);

    if (comparison.matchedCanonical.includes(skill)) {
      if (!Number.isFinite(resumeYears)) {
        return {
          skill,
          status: "matched_unknown_maturity",
          fitScore: 60,
          expectedYoe,
          marketDemandScore,
        };
      }

      if (resumeYears >= Math.max(0, expectedYoe - 1)) {
        return {
          skill,
          status: "matched_at_target_level",
          fitScore: 100,
          expectedYoe,
          marketDemandScore,
        };
      }

      return {
        skill,
        status: "matched_below_target_maturity",
        fitScore: Math.max(40, Math.round(100 - (expectedYoe - resumeYears) * 20)),
        expectedYoe,
        marketDemandScore,
      };
    }

    return {
      skill,
      status: marketDemandScore >= 70 ? "missing_high_impact" : "missing",
      fitScore: 0,
      expectedYoe,
      marketDemandScore,
    };
  });

  return {
    score: Math.round(average(evidence.map((item) => item.fitScore))),
    evidence,
    candidateLevel: candidateLevelLabel(resumeYears),
  };
}

export function computeRoleCooccurrenceFit({
  resumeSkills = [],
  roleTitle = "",
  targetYoeLabel = null,
}) {
  const score = getRoleSupportScore(resumeSkills, roleTitle, targetYoeLabel);
  return {
    score,
    explanation:
      score > 0
        ? `Resume skills have ${score}% benchmark support within the ${roleTitle || "target"} role profile.`
        : "Role co-occurrence support could not be established strongly from the benchmark profile.",
  };
}

export function computeTitleAlignment({
  targetTitleCandidates = [],
  jobTitle = "",
  jobNormalizedTitle = "",
}) {
  const normalizedJobTitle = String(jobNormalizedTitle || jobTitle || "").toLowerCase().trim();
  const normalizedTargets = targetTitleCandidates.map((title) => String(title).toLowerCase().trim()).filter(Boolean);

  const exactTarget = normalizedTargets.find(
    (title) => title === normalizedJobTitle || normalizedJobTitle.includes(title) || title.includes(normalizedJobTitle)
  );

  if (exactTarget) {
    return {
      score: 95,
      explanation: `${jobTitle} is closely aligned to the extracted target role family.`,
    };
  }

  const relevantRoles = findRelevantRoles([], targetTitleCandidates, 10);
  const bestRole = relevantRoles.find((role) => role.normalizedTitle === normalizedJobTitle);
  if (bestRole) {
    return {
      score: Math.max(70, Math.round(bestRole.score * 100)),
      explanation: `${jobTitle} is closely aligned to the extracted target role family.`,
    };
  }

  const targetTokens = targetTitleCandidates
    .flatMap((title) => String(title).toLowerCase().split(/[^a-z0-9]+/))
    .filter((token) => token.length > 2);
  const jobTokens = String(normalizedJobTitle)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
  const overlap = jobTokens.filter((token) => targetTokens.includes(token)).length;
  const score = targetTokens.length ? Math.round((overlap / new Set(targetTokens).size) * 100) : 50;

  return {
    score,
    explanation:
      score >= 50
        ? `${jobTitle} shares meaningful title overlap with the target role wording.`
        : `${jobTitle} is transferable, but title alignment to the target role is weaker.`,
  };
}

export function computeDemandAlignment({
  matchedCanonical = [],
  missingCanonical = [],
}) {
  const matchedDemand = averageOrZero(matchedCanonical.map((skill) => getGlobalSkillDemandScore(skill)));
  const missingDemand = averageOrZero(missingCanonical.map((skill) => getGlobalSkillDemandScore(skill)));
  const score = Math.round(Math.max(0, Math.min(100, matchedDemand - missingDemand * 0.35 + 35)));

  return {
    score,
    explanation:
      matchedCanonical.length
        ? `Matched skills carry an average benchmark demand score of ${Math.round(matchedDemand)} while remaining gaps average ${Math.round(missingDemand)}.`
        : "Demand alignment is low because the role's strongest benchmark skills are still missing.",
  };
}

export function buildRecommendationConfidence({
  exactSkillCoverageScore = 0,
  skillLevelFitScore = 0,
  experienceAlignmentScore = 0,
  titleAlignmentScore = 0,
}) {
  const score = Math.round(
    exactSkillCoverageScore * 0.35 +
      skillLevelFitScore * 0.25 +
      experienceAlignmentScore * 0.25 +
      titleAlignmentScore * 0.15
  );

  return {
    score,
    label: score >= 80 ? "High confidence" : score >= 60 ? "Medium confidence" : "Exploratory match",
  };
}

export function buildHybridScore({
  exactSkillCoverageScore = 0,
  skillCoverageScore = exactSkillCoverageScore,
  skillLevelFitScore = 0,
  semanticSimilarityScore = 0,
  experienceAlignmentScore = 0,
  roleCooccurrenceFitScore = 0,
}) {
  const exactScore = exactSkillCoverageScore || skillCoverageScore;
  return Math.round(
    exactScore * 0.35 +
      skillLevelFitScore * 0.2 +
      semanticSimilarityScore * 0.2 +
      experienceAlignmentScore * 0.15 +
      roleCooccurrenceFitScore * 0.1
  );
}

export function buildJobExplanation({
  title,
  skillComparison,
  skillLevelFit,
  semanticSimilarityScore,
  experienceAlignment,
  roleCooccurrenceFit,
  titleAlignment,
  demandAlignment,
  recommendationConfidence,
}) {
  const reasons = [
    `${title} has ${skillComparison.matchedSkills.length} matched skills and ${skillComparison.missingSkills.length} missing skills.`,
    `Exact skill coverage contributes ${skillComparison.exactSkillCoverageScore}% to the hybrid-v2 recommendation evidence.`,
    `Skill maturity fit scored ${skillLevelFit.score}% after comparing expected skill level to estimated resume experience.`,
    `Semantic similarity baseline scored ${semanticSimilarityScore}%.`,
    experienceAlignment.explanation,
    roleCooccurrenceFit.explanation,
    titleAlignment?.explanation,
    demandAlignment?.explanation,
    recommendationConfidence ? `${recommendationConfidence.label} based on coverage, maturity, experience, and title alignment.` : null,
  ];

  const maturitySignals = skillLevelFit.evidence
    .filter((item) => item.status === "matched_below_target_maturity" || item.status === "missing_high_impact")
    .slice(0, 2)
    .map((item) =>
      item.status === "matched_below_target_maturity"
        ? `${toDisplaySkill(item.skill)} appears relevant, but the benchmark expects a stronger maturity level.`
        : `${toDisplaySkill(item.skill)} is missing and has high benchmark demand.`
    );

  return reasons.filter(Boolean).concat(maturitySignals);
}

export function normalizeSkillList(skills = []) {
  return normalizeSkills(skills);
}

export function getTargetYoeBandFromYears(years) {
  return getNearestYoeBand(years);
}
