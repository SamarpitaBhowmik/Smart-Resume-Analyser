import {
  findRelevantRoles,
  getAdjacentSkills,
  getDemandByYoe,
  getExpectedSkillYoe,
  getGlobalSkillDemandScore,
  getNearestYoeBand,
  getRoleNeedScore,
} from "./benchmarkContext.js";
import { getLearningProfile, inferSkillCategory } from "./learningData.js";
import { normalizeSkill } from "./normaliseSkills.js";
import { analyzeJDContexts } from "./jobRequirementExtractor.js";

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

export function isEngineeringRole(targetTitleCandidates = [], roleTitles = []) {
  const titles = [...targetTitleCandidates, ...roleTitles];
  const engKeywords = [
    "engineer", "developer", "programmer", "architect", "coder", "scientist", 
    "devops", "sre", "sysops", "fullstack", "full stack", "backend", "frontend",
    "technical", "tech lead", "software", "infrastructure", "dba", "administrator",
    "systems analyst", "data analyst", "qa analyst", "webmaster"
  ];
  return titles.some((t) => {
    const lower = String(t || "").toLowerCase();
    return engKeywords.some((kw) => lower.includes(kw));
  });
}

export function isCoreTechnicalSkill(skill) {
  const category = inferSkillCategory(skill);
  if (category === "professional") return false;
  
  const softKeywords = [
    "communication", "collaboration", "teamwork", "leadership", "problem solving",
    "critical thinking", "creativity", "time management", "organization", "project management",
    "agile", "scrum", "interpersonal", "presentation", "negotiation", "conflict resolution",
    "adaptability", "flexibility", "work ethic", "attention to detail", "emotional intelligence",
    "decision making", "public speaking", "written communication", "verbal communication",
    "active listening", "empathy", "mentoring", "coaching"
  ];
  const norm = String(skill || "").toLowerCase().trim();
  if (softKeywords.some((kw) => norm.includes(kw))) {
    return false;
  }
  
  return true;
}

function buildPriorityReason({
  skill,
  jdContext,
  isCoreTech,
  isEngineering,
  readiness,
  expectedSkillYoe,
  roleNeedScore,
  marketDemandScore,
  focusBoost,
}) {
  const reasons = [];

  // 1. JD Context (Highest priority)
  if (jdContext === "required") {
    reasons.push(`${skill} is explicitly required as a core qualification in the job description.`);
  } else if (jdContext === "responsibilities") {
    reasons.push(`${skill} is key to the main responsibilities and day-to-day duties.`);
  } else if (jdContext === "preferred") {
    reasons.push(`${skill} is listed as a preferred/nice-to-have capability in the job description.`);
  } else if (jdContext === "general") {
    reasons.push(`${skill} is mentioned in the job context as a relevant skill.`);
  } else {
    reasons.push(`${skill} is recommended based on benchmark alignment for the role.`);
  }

  // 2. Role Criticality / Engineering focus
  if (isEngineering && isCoreTech) {
    reasons.push(`Highly critical technical competency expected for this engineering pathway.`);
  }

  // 3. Resume Evidence Gap / Readiness
  if (focusBoost > 0) {
    reasons.push(`Selected as the focus skill for this learning plan.`);
  } else if (readiness.score >= 75) {
    reasons.push(`Great candidate readiness; you already meet most prerequisites.`);
  } else if (expectedSkillYoe > 3) {
    reasons.push(`Senior-level skill requiring a solid depth of experience.`);
  }

  // 4. Benchmark support (lowest influence)
  if (roleNeedScore >= 75) {
    reasons.push(`Strong industry alignment; frequently expected in comparable role benchmarks.`);
  }

  return reasons.slice(0, 3);
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
  jobDescription = "",
  skillsContext = null,
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

  const resolvedContexts = skillsContext || (jobDescription ? analyzeJDContexts(jobDescription, targetCanonicalSkills) : {});

  const isEng = isEngineeringRole(targetTitleCandidates, roleTitles);

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

    // 1. JD Importance Score (0 to 100)
    const isDirectJD = targetCanonicalSkills.includes(skill);
    const skillCtx = resolvedContexts[skill] || {};
    const ctxCategory = skillCtx.context || (isDirectJD ? "general" : "none");
    
    let jdImportanceScore = 15; // default for benchmark-inferred
    if (isDirectJD) {
      if (ctxCategory === "required") jdImportanceScore = 100;
      else if (ctxCategory === "responsibilities") jdImportanceScore = 80;
      else if (ctxCategory === "preferred") jdImportanceScore = 55;
      else jdImportanceScore = 40;
    }

    // 2. Role Criticality Score (0 to 100)
    const isCoreTech = isCoreTechnicalSkill(skill);
    let criticalityScore = 70; // default for non-engineering role
    if (isEng) {
      if (isCoreTech) {
        criticalityScore = 100;
      } else {
        const explicitlyEmphasized = skillCtx.explicitlyEmphasized || skillCtx.weight >= 2.5;
        criticalityScore = explicitlyEmphasized ? 50 : 10;
      }
    } else {
      const category = inferSkillCategory(skill);
      const isDesignRole = [...targetTitleCandidates, ...roleTitles].some(r => /design|ux|ui|creative|artist/i.test(r));
      const isDataRole = [...targetTitleCandidates, ...roleTitles].some(r => /data|analyst|analytics|bi|scientist/i.test(r));
      if (isDesignRole && category === "design") {
        criticalityScore = 90;
      } else if (isDataRole && category === "data") {
        criticalityScore = 90;
      }
    }

    // 3. Resume Evidence Gap Score (0 to 100)
    const resumeGapScore = Math.round(readiness.score * 0.6 + Math.min(100, expectedSkillYoe * 15) * 0.4);

    // 4. Benchmark Support Score (0 to 100)
    const benchmarkScore = Math.round(roleNeedScore * 0.6 + marketDemandScore * 0.4);

    // Combine using new scoring hierarchy weights
    const jdWeight = 0.50;      // 50%
    const criticalityWeight = 0.25; // 25%
    const gapWeight = 0.15;      // 15%
    const benchmarkWeight = 0.10; // 10%

    let priorityScore = Math.round(
      jdImportanceScore * jdWeight +
      criticalityScore * criticalityWeight +
      resumeGapScore * gapWeight +
      benchmarkScore * benchmarkWeight +
      focusBoost
    );

    // Enforce Rule: A missing core technical skill must never be outranked by a generic professional skill for engineering roles.
    if (isEng) {
      if (isCoreTech) {
        priorityScore = Math.round(65 + (priorityScore / 100) * 35);
      } else {
        priorityScore = Math.round(10 + (priorityScore / 100) * 50);
      }
    }

    const adjacentSkills = getAdjacentSkills(skill, 6);
    const reason = buildPriorityReason({
      skill,
      jdContext: ctxCategory,
      isCoreTech,
      isEngineering: isEng,
      readiness,
      expectedSkillYoe,
      roleNeedScore,
      marketDemandScore,
      focusBoost,
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
    .sort((a, b) => {
      // Force core technical skills to outrank professional skills for engineering roles
      if (isEng) {
        const aCore = isCoreTechnicalSkill(a.skill);
        const bCore = isCoreTechnicalSkill(b.skill);
        if (aCore !== bCore) {
          return aCore ? -1 : 1;
        }
      }
      return b.priorityScore - a.priorityScore;
    });

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
