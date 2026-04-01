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
  const skillCoverageScore = jobMap.size
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
    skillCoverageScore,
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

export function buildHybridScore({
  skillCoverageScore = 0,
  semanticSimilarityScore = 0,
  experienceAlignmentScore = 0,
}) {
  return Math.round(
    skillCoverageScore * 0.5 +
      semanticSimilarityScore * 0.3 +
      experienceAlignmentScore * 0.2
  );
}

export function buildJobExplanation({
  title,
  skillComparison,
  semanticSimilarityScore,
  experienceAlignment,
}) {
  const reasons = [
    `${title} has ${skillComparison.matchedSkills.length} matched skills and ${skillComparison.missingSkills.length} missing skills.`,
    `Exact skill coverage contributes ${skillComparison.skillCoverageScore}% to the recommendation evidence.`,
    `Semantic similarity baseline scored ${semanticSimilarityScore}%.`,
    experienceAlignment.explanation,
  ];

  if (skillComparison.semanticMatches.length) {
    reasons.push(
      `Semantic normalization aligned ${skillComparison.semanticMatches.length} equivalent skill pairs.`
    );
  }

  return reasons;
}

export function normalizeSkillList(skills = []) {
  return normalizeSkills(skills);
}
