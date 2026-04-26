import fs from "fs";

import { getProcessedPaths } from "./datasetPipeline.js";
import { normalizeSkill, normalizeTitle } from "./normaliseSkills.js";

let cachedContext = null;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreFromRatio(value, maxValue) {
  if (!maxValue) return 0;
  return Math.round((value / maxValue) * 100);
}

function normalizeSkillArray(skills = []) {
  return [...new Set((skills || []).map((skill) => normalizeSkill(skill)).filter(Boolean))];
}

function yoeBandFromYears(years) {
  if (!Number.isFinite(years)) return "0-1";
  if (years < 1.5) return "0-1";
  if (years < 3) return "2-3";
  if (years < 5) return "3-5";
  return "5+";
}

function buildRoleProfiles(jobPostings) {
  const roleProfiles = new Map();

  jobPostings.forEach((job) => {
    const roleKey = normalizeTitle(job.normalizedTitle || job.title || "");
    if (!roleKey) return;

    if (!roleProfiles.has(roleKey)) {
      roleProfiles.set(roleKey, {
        normalizedTitle: roleKey,
        displayTitles: new Set(),
        skillCounts: new Map(),
        yoeSkillCounts: new Map(),
        count: 0,
      });
    }

    const profile = roleProfiles.get(roleKey);
    profile.count += 1;
    profile.displayTitles.add(job.title);

    normalizeSkillArray(job.skills).forEach((skill) => {
      profile.skillCounts.set(skill, (profile.skillCounts.get(skill) || 0) + 1);

      if (!profile.yoeSkillCounts.has(job.yoeLabel)) {
        profile.yoeSkillCounts.set(job.yoeLabel, new Map());
      }
      const skillMap = profile.yoeSkillCounts.get(job.yoeLabel);
      skillMap.set(skill, (skillMap.get(skill) || 0) + 1);
    });
  });

  return roleProfiles;
}

function buildContext(skillFacts, jobPostings) {
  const skillDemand = new Map();
  const skillDemandByYoe = new Map();
  const skillExpectedYoe = new Map();
  const cooccurrence = new Map();
  const roleProfiles = buildRoleProfiles(jobPostings);
  const jobSkillSets = [];
  const knownSkills = new Set();

  skillFacts.forEach((fact) => {
    const skill = normalizeSkill(fact.skill);
    knownSkills.add(skill);
    skillDemand.set(skill, (skillDemand.get(skill) || 0) + 1);

    if (!skillDemandByYoe.has(skill)) {
      skillDemandByYoe.set(skill, new Map());
    }
    const yoeMap = skillDemandByYoe.get(skill);
    yoeMap.set(fact.yoeLabel, (yoeMap.get(fact.yoeLabel) || 0) + 1);

    if (!skillExpectedYoe.has(skill)) {
      skillExpectedYoe.set(skill, []);
    }
    skillExpectedYoe.get(skill).push(fact.yoeMid);
  });

  jobPostings.forEach((job) => {
    const skills = normalizeSkillArray(job.skills);
    const skillSet = new Set(skills);
    jobSkillSets.push({
      normalizedTitle: normalizeTitle(job.normalizedTitle || job.title || ""),
      yoeLabel: job.yoeLabel,
      skills,
    });

    skills.forEach((skill) => {
      if (!cooccurrence.has(skill)) {
        cooccurrence.set(skill, new Map());
      }
      skills.forEach((otherSkill) => {
        if (skill === otherSkill) return;
        const skillMap = cooccurrence.get(skill);
        skillMap.set(otherSkill, (skillMap.get(otherSkill) || 0) + 1);
      });
    });

    skillSet.forEach((skill) => knownSkills.add(skill));
  });

  const maxSkillDemand = Math.max(...skillDemand.values(), 1);
  const maxYoeDemand = Math.max(
    ...Array.from(skillDemandByYoe.values()).flatMap((entry) => Array.from(entry.values())),
    1
  );

  const knownTitles = Array.from(roleProfiles.keys());

  return {
    skillFacts,
    jobPostings,
    roleProfiles,
    skillDemand,
    skillDemandByYoe,
    skillExpectedYoe,
    cooccurrence,
    knownSkills,
    knownTitles,
    jobSkillSets,
    maxSkillDemand,
    maxYoeDemand,
  };
}

export function getBenchmarkContext() {
  if (cachedContext) return cachedContext;

  const { skillFactsPath, jobPostingsPath } = getProcessedPaths();
  const skillFacts = readJson(skillFactsPath);
  const jobPostings = readJson(jobPostingsPath);
  cachedContext = buildContext(skillFacts, jobPostings);
  return cachedContext;
}

export function getNearestYoeBand(years) {
  return yoeBandFromYears(years);
}

export function getGlobalSkillDemandScore(skill) {
  const context = getBenchmarkContext();
  const normalizedSkill = normalizeSkill(skill);
  return scoreFromRatio(context.skillDemand.get(normalizedSkill) || 0, context.maxSkillDemand);
}

export function getSkillDemandForYoe(skill, yoeLabel) {
  const context = getBenchmarkContext();
  const normalizedSkill = normalizeSkill(skill);
  const demand = context.skillDemandByYoe.get(normalizedSkill)?.get(yoeLabel) || 0;
  return {
    count: demand,
    score: scoreFromRatio(demand, context.maxYoeDemand),
  };
}

export function getExpectedSkillYoe(skill, roleTitles = [], yoeLabel = null) {
  const context = getBenchmarkContext();
  const normalizedSkill = normalizeSkill(skill);
  const normalizedRoles = roleTitles.map((title) => normalizeTitle(title)).filter(Boolean);

  const roleValues = [];
  if (normalizedRoles.length) {
    normalizedRoles.forEach((role) => {
      const profile = context.roleProfiles.get(normalizeTitle(role));
      if (!profile) return;

      if (yoeLabel && profile.yoeSkillCounts.has(yoeLabel)) {
        const count = profile.yoeSkillCounts.get(yoeLabel).get(normalizedSkill) || 0;
        if (count > 0) {
          const fallback = yoeLabel === "0-1" ? 1 : yoeLabel === "2-3" ? 2.5 : yoeLabel === "3-5" ? 4 : 6;
          roleValues.push(fallback);
        }
      }
    });
  }

  if (roleValues.length) {
    return Number(average(roleValues).toFixed(1));
  }

  const globalValues = context.skillExpectedYoe.get(normalizedSkill) || [];
  return globalValues.length ? Number(average(globalValues).toFixed(1)) : 2;
}

export function getAdjacentSkills(skill, limit = 8) {
  const context = getBenchmarkContext();
  const normalizedSkill = normalizeSkill(skill);
  return Array.from(context.cooccurrence.get(normalizedSkill)?.entries() || [])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([adjacentSkill, count]) => ({ skill: adjacentSkill, count }));
}

export function findRelevantRoles(targetSkills = [], titleCandidates = [], limit = 5) {
  const context = getBenchmarkContext();
  const normalizedSkills = normalizeSkillArray(targetSkills);
  const normalizedTitles = titleCandidates.map((title) => normalizeTitle(title)).filter(Boolean);

  const results = context.knownTitles
    .map((role) => {
      const profile = context.roleProfiles.get(role);
      const roleSkills = new Set(profile ? Array.from(profile.skillCounts.keys()) : []);
      const overlapCount = normalizedSkills.filter((skill) => roleSkills.has(skill)).length;
      const titleMatch = normalizedTitles.some(
        (candidate) => role.includes(candidate) || candidate.includes(role)
      )
        ? 1
        : 0;
      const overlapScore = normalizedSkills.length
        ? overlapCount / normalizedSkills.length
        : 0;
      const score = overlapScore * 0.75 + titleMatch * 0.25;

      return {
        normalizedTitle: role,
        displayTitle: Array.from(profile?.displayTitles || [role])[0],
        overlapCount,
        score,
      };
    })
    .filter((role) => role.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

export function getRoleNeedScore(skill, roleTitles = [], yoeLabel = null) {
  const context = getBenchmarkContext();
  const normalizedSkill = normalizeSkill(skill);
  const roles = roleTitles.length
    ? roleTitles.map((title) => normalizeTitle(title))
    : context.knownTitles;

  const scores = roles
    .map((role) => {
      const profile = context.roleProfiles.get(role);
      if (!profile) return 0;

      if (yoeLabel && profile.yoeSkillCounts.has(yoeLabel)) {
        const skillMap = profile.yoeSkillCounts.get(yoeLabel);
        const maxCount = Math.max(...skillMap.values(), 1);
        return scoreFromRatio(skillMap.get(normalizedSkill) || 0, maxCount);
      }

      const maxCount = Math.max(...profile.skillCounts.values(), 1);
      return scoreFromRatio(profile.skillCounts.get(normalizedSkill) || 0, maxCount);
    })
    .filter((value) => value > 0);

  return scores.length ? Math.round(average(scores)) : getGlobalSkillDemandScore(normalizedSkill);
}

export function getRoleSupportScore(resumeSkills = [], roleTitle = "", yoeLabel = null) {
  const context = getBenchmarkContext();
  const normalizedTitle = normalizeTitle(roleTitle);
  const profile = context.roleProfiles.get(normalizedTitle);
  if (!profile) return 0;

  const normalizedResumeSkills = normalizeSkillArray(resumeSkills);
  const skillMap =
    yoeLabel && profile.yoeSkillCounts.has(yoeLabel)
      ? profile.yoeSkillCounts.get(yoeLabel)
      : profile.skillCounts;

  const maxCount = Math.max(...skillMap.values(), 1);
  const scores = normalizedResumeSkills
    .map((skill) => scoreFromRatio(skillMap.get(skill) || 0, maxCount))
    .filter((value) => value > 0);

  return scores.length ? Math.round(average(scores)) : 0;
}

export function getDemandByYoe(skill) {
  const context = getBenchmarkContext();
  const normalizedSkill = normalizeSkill(skill);
  return Array.from(context.skillDemandByYoe.get(normalizedSkill)?.entries() || [])
    .map(([yoeRange, count]) => ({
      yoeRange,
      demand: count,
    }))
    .sort((a, b) => {
      const weight = { "0-1": 1, "2-3": 2, "3-5": 3, "5+": 4 };
      return (weight[a.yoeRange] || 99) - (weight[b.yoeRange] || 99);
    });
}
