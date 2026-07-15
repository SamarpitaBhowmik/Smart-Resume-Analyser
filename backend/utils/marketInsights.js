import { getJobSuggestionsForResume } from "../controllers/analysisController.js";
import { getValidationSummary } from "./datasetPipeline.js";
import Job from "../models/jobs.js";
import SkillsData from "../models/SkillsData.js";
import {
  buildHybridScore,
  buildSkillComparison,
  computeExperienceAlignment,
  computeRoleCooccurrenceFit,
  computeSkillLevelFit,
  estimateResumeExperienceYears,
  getTargetYoeBandFromYears,
  normalizeSkillList,
} from "./jobMatching.js";
import { buildEvidenceBackedRoadmap } from "./roadmapBuilder.js";
import { getCatalogEntriesForSkill } from "./learningData.js";
import { normalizeSkill } from "./normaliseSkills.js";

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function readResumeField(resume, key) {
  if (!resume) return undefined;
  if (typeof resume.get === "function") {
    const value = resume.get(key);
    if (value !== undefined) return value;
  }
  return resume[key];
}

function buildRoadmapInputs(resume, latestAnalysis, focusSkill = null) {
  const resumeSkills = resume.extracted?.skills || [];
  const resumeCanonicalSkills = normalizeSkillList(resumeSkills);
  const resumeYears = estimateResumeExperienceYears(resume.extracted?.experience || []);

  return {
    resumeCanonicalSkills,
    resumeYears,
    targetCanonicalSkills:
      latestAnalysis.extractedJobRequirements?.canonicalSkills ||
      latestAnalysis.match?.jobCanonicalSkills ||
      normalizeSkillList(latestAnalysis.match?.jobSkills || []),
    missingCanonicalSkills:
      latestAnalysis.match?.missingCanonicalSkills ||
      normalizeSkillList(latestAnalysis.match?.missingSkills || []),
    targetYoeMin: latestAnalysis.extractedJobRequirements?.yoeMin ?? 0,
    targetYoeMax: latestAnalysis.extractedJobRequirements?.yoeMax ?? null,
    targetTitleCandidates: latestAnalysis.extractedJobRequirements?.titleCandidates || [],
    focusSkill,
  };
}

function uniqueItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.course_id || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function labelForStatus(status = "") {
  const labels = {
    matched_at_target_level: "Matched at target level",
    matched_below_target_maturity: "Matched but below target maturity",
    matched_unknown_maturity: "Matched, maturity uncertain",
    missing_high_impact: "Missing and high impact",
    missing: "Missing",
  };
  return labels[status] || status.replace(/_/g, " ");
}

function buildMaturitySummary(evidence = []) {
  const counts = {
    matchedAtTargetLevel: 0,
    matchedBelowTargetMaturity: 0,
    matchedUnknownMaturity: 0,
    missingHighImpact: 0,
    missingOther: 0,
  };

  evidence.forEach((item) => {
    if (item.status === "matched_at_target_level") counts.matchedAtTargetLevel += 1;
    else if (item.status === "matched_below_target_maturity") counts.matchedBelowTargetMaturity += 1;
    else if (item.status === "matched_unknown_maturity") counts.matchedUnknownMaturity += 1;
    else if (item.status === "missing_high_impact") counts.missingHighImpact += 1;
    else counts.missingOther += 1;
  });

  const chartData = [
    {
      name: "Ready now",
      count: counts.matchedAtTargetLevel,
      color: "#34d399",
    },
    {
      name: "Needs depth",
      count: counts.matchedBelowTargetMaturity + counts.matchedUnknownMaturity,
      color: "#38bdf8",
    },
    {
      name: "High-impact gap",
      count: counts.missingHighImpact,
      color: "#f59e0b",
    },
    {
      name: "Other gap",
      count: counts.missingOther,
      color: "#f43f5e",
    },
  ].filter((item) => item.count > 0);

  const signals = [...evidence]
    .filter(
      (item) =>
        item.status === "missing_high_impact" ||
        item.status === "matched_below_target_maturity" ||
        item.status === "matched_unknown_maturity"
    )
    .sort((a, b) => {
      if ((b.marketDemandScore || 0) !== (a.marketDemandScore || 0)) {
        return (b.marketDemandScore || 0) - (a.marketDemandScore || 0);
      }
      return (b.expectedYoe || 0) - (a.expectedYoe || 0);
    })
    .slice(0, 5)
    .map((item) => ({
      skill: item.skill,
      label: labelForStatus(item.status),
      expectedYoe: item.expectedYoe,
      marketDemandScore: item.marketDemandScore,
      status: item.status,
    }));

  const totalSkills = evidence.length;
  const readySkills = counts.matchedAtTargetLevel;

  return {
    totalSkills,
    readySkills,
    readyRatio: totalSkills ? Math.round((readySkills / totalSkills) * 100) : 0,
    ...counts,
    chartData,
    signals,
  };
}

function buildDemandCurve(demandByYoe = [], candidateBand = "", targetBand = "") {
  const maxDemand = Math.max(...demandByYoe.map((item) => item.demand), 1);
  const sorted = [...demandByYoe].sort((a, b) => {
    const weights = { "0-1": 1, "2-3": 2, "3-5": 3, "5+": 4 };
    return (weights[a.yoeRange] || 99) - (weights[b.yoeRange] || 99);
  });
  const peak = sorted.reduce(
    (best, current) => ((current.demand || 0) > (best.demand || 0) ? current : best),
    sorted[0] || null
  );

  return {
    candidateBand,
    targetBand,
    peakBand: peak?.yoeRange || null,
    series: sorted.map((item) => ({
      ...item,
      demandScore: Math.round(((item.demand || 0) / maxDemand) * 100),
      isCandidateBand: item.yoeRange === candidateBand,
      isTargetBand: item.yoeRange === targetBand,
    })),
  };
}

function buildAdjacentSkillSeries(adjacentSkills = [], resumeSkillSet = new Set()) {
  return adjacentSkills.slice(0, 8).map((item) => ({
    skill: item.skill,
    count: item.count,
    alreadyOwned: resumeSkillSet.has(normalizeSkill(item.skill)),
    label: resumeSkillSet.has(normalizeSkill(item.skill)) ? "Already on resume" : "Useful bundle",
  }));
}

function buildRoleImpactSeries({
  jobs = [],
  resumeSkills = [],
  resumeYears = null,
  focusSkill = "",
}) {
  const normalizedFocusSkill = normalizeSkill(focusSkill);
  if (!normalizedFocusSkill) {
    return {
      averageLift: 0,
      maxLift: 0,
      roles: [],
    };
  }

  const augmentedResumeSkills = [...resumeSkills, normalizedFocusSkill];
  const roles = jobs.slice(0, 5).map((job) => {
    const projectedComparison = buildSkillComparison(augmentedResumeSkills, job.skills || []);
    const projectedSkillLevel = computeSkillLevelFit({
      resumeSkills: augmentedResumeSkills,
      jobSkills: job.skills || [],
      resumeYears,
      roleTitles: [job.normalizedTitle || job.title],
      targetYoeLabel: job.targetYoeBand || job.yoeLabel,
    });
    const projectedExperience = computeExperienceAlignment(resumeYears, job.yoeMin, job.yoeMax);
    const projectedCooccurrence = computeRoleCooccurrenceFit({
      resumeSkills: augmentedResumeSkills,
      roleTitle: job.normalizedTitle || job.title,
      targetYoeLabel: job.targetYoeBand || job.yoeLabel,
    });
    const projectedFit = buildHybridScore({
      exactSkillCoverageScore: projectedComparison.exactSkillCoverageScore,
      skillLevelFitScore: projectedSkillLevel.score,
      semanticSimilarityScore: job.semanticScore || 0,
      experienceAlignmentScore: projectedExperience.score,
      roleCooccurrenceFitScore: projectedCooccurrence.score,
    });

    return {
      title: job.title,
      company: job.company,
      currentFit: job.finalScore,
      projectedFit,
      uplift: Math.max(0, projectedFit - job.finalScore),
      matchedSkills: job.matchedSkills?.length || 0,
      missingSkills: job.missingSkills?.length || 0,
      focusSkillAlreadyCovered:
        normalizeSkillList(job.matchedSkills || []).includes(normalizedFocusSkill) ||
        normalizeSkillList(resumeSkills).includes(normalizedFocusSkill),
    };
  });

  return {
    averageLift: Math.round(average(roles.map((item) => item.uplift))),
    maxLift: Math.max(...roles.map((item) => item.uplift), 0),
    roles,
  };
}

function buildNarrative({
  focusMeta,
  demandCurve,
  roleImpact,
  maturity,
  candidateBand,
  targetBand,
}) {
  if (!focusMeta) {
    return {
      headline: "Market intelligence becomes available after resume analysis runs.",
      bullets: [],
    };
  }

  const bullets = [
    `${focusMeta.skill} is prioritized because it scores ${focusMeta.priorityScore}% across role need, market demand, experience-band demand, readiness, and effort.`,
    `${focusMeta.skill} peaks in the ${demandCurve.peakBand || targetBand || "target"} experience band while your current profile maps to ${candidateBand || "an unknown"} band.`,
    roleImpact.maxLift > 0
      ? `Closing this gap is projected to improve your top benchmark-role fit by up to ${roleImpact.maxLift} points.`
      : `This gap matters more for benchmark depth and market alignment than for an immediate fit-score jump.`,
    maturity.matchedBelowTargetMaturity > 0
      ? `${maturity.matchedBelowTargetMaturity} existing skills appear relevant but still need deeper maturity for the target role.`
      : `${maturity.readySkills} tracked skills are already benchmark-ready for the current target.`,
  ];

  return {
    headline:
      roleImpact.averageLift > 0
        ? `Learning ${focusMeta.skill} is the clearest way to improve role fit right now.`
        : `${focusMeta.skill} is the strongest market-backed opportunity area for this profile.`,
    bullets,
  };
}

function buildRoadmapLinkage(roadmap, focusSkill) {
  const allItems = uniqueItems([
    ...(roadmap?.courses || []),
    ...(roadmap?.projects || []),
    ...(roadmap?.resources || []),
  ]);
  const focusItems = allItems.filter((item) => item.targetSkill === focusSkill);
  const selectedItems = (focusItems.length ? focusItems : allItems)
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
    .slice(0, 4)
    .map((item) => ({
      title: item.title,
      format: item.format,
      provider: item.provider,
      targetSkill: item.targetSkill,
      priorityScore: item.priorityScore,
      estimatedWeeks: item.estimated_weeks,
      selectedBecause: item.selectedBecause || [],
    }));

  return {
    topItems: selectedItems,
  };
}

function buildMethodologySnapshot(validationSummary) {
  return {
    analyticsVersion: "market-intelligence-v1",
    hybridMatching:
      "0.35 exact skill coverage + 0.20 skill level fit + 0.20 semantic similarity + 0.15 experience alignment + 0.10 role co-occurrence fit",
    priorityModel:
      "0.35 target role need + 0.25 market demand + 0.15 target YOE demand + 0.15 readiness + 0.10 effort inverse",
    roleImpactModel:
      "Projected role lift simulates adding the selected skill to the resume, then recomputes exact coverage, skill-level fit, and role co-occurrence support while keeping experience and semantic baselines stable.",
    datasetVersion: validationSummary?.datasetVersion || "unknown",
  };
}

function sortYoeLabels(items = []) {
  return [...items].sort((a, b) => {
    const left = a.yoeMin ?? 999;
    const right = b.yoeMin ?? 999;
    if (left !== right) return left - right;
    return String(a.yoeRange || a.yoeLabel || "").localeCompare(String(b.yoeRange || b.yoeLabel || ""));
  });
}

function buildGlobalNarrative({ spotlightSkill, topSkills = [], roleFamilies = [], yoeDistribution = [] }) {
  const strongestSkill = topSkills[0];
  const strongestRole = roleFamilies[0];
  const busiestBand = [...yoeDistribution].sort((a, b) => (b.demand || 0) - (a.demand || 0))[0];

  return {
    headline: spotlightSkill
      ? `${spotlightSkill} is a strong benchmark signal across roles, experience bands, and learning paths.`
      : `${strongestSkill?.skill || "Top skills"} currently anchor the benchmark market dataset.`,
    bullets: [
      strongestSkill
        ? `${strongestSkill.skill} appears in ${strongestSkill.demand} benchmark role-skill facts across ${strongestSkill.roleCoverage} distinct role families.`
        : "Skill frequency data becomes available once the benchmark dataset has been processed.",
      strongestRole
        ? `${strongestRole.title} is one of the densest benchmark role families, with ${strongestRole.avgSkillLoad} average tracked skills per role profile.`
        : "Role-family concentration could not be determined from the current dataset snapshot.",
      busiestBand
        ? `${busiestBand.yoeRange} years is the busiest demand band in the benchmark data, covering ${busiestBand.uniqueSkillsCount} unique skills.`
        : "Experience-band demand could not be determined from the current dataset snapshot.",
      spotlightSkill
        ? `${spotlightSkill} includes both market-demand evidence and linked learning coverage, so users can explore what matters and how to act on it without uploading a resume first.`
        : "The global page is designed to explain what the benchmark market values, even before a candidate-specific analysis exists.",
    ],
  };
}

function buildTopSkillSeries(topSkills = []) {
  const maxDemand = Math.max(...topSkills.map((item) => item.demand || 0), 1);
  return topSkills.map((item) => ({
    ...item,
    demandScore: Math.round(((item.demand || 0) / maxDemand) * 100),
  }));
}

export async function buildGlobalMarketInsights(focusSkill = null) {
  const validationSummary = await getValidationSummary();

  const [topSkillsRaw, roleFamiliesRaw, yoeDistributionRaw] = await Promise.all([
    SkillsData.aggregate([
      {
        $group: {
          _id: "$skill",
          demand: { $sum: 1 },
          roles: { $addToSet: "$normalizedTitle" },
          jobIds: { $addToSet: "$jobId" },
        },
      },
      {
        $project: {
          _id: 0,
          skill: "$_id",
          demand: 1,
          roleCoverage: { $size: "$roles" },
          postingCoverage: { $size: "$jobIds" },
        },
      },
      { $sort: { demand: -1, roleCoverage: -1, skill: 1 } },
      { $limit: 12 },
    ]),
    Job.aggregate([
      {
        $project: {
          _id: 0,
          title: 1,
          normalizedTitle: 1,
          yoeLabel: 1,
          skillCount: { $size: { $ifNull: ["$skills", []] } },
        },
      },
      {
        $group: {
          _id: "$normalizedTitle",
          title: { $first: "$title" },
          demand: { $sum: 1 },
          avgSkillLoad: { $avg: "$skillCount" },
          yoeBands: { $addToSet: "$yoeLabel" },
        },
      },
      {
        $project: {
          _id: 0,
          title: "$title",
          normalizedTitle: "$_id",
          demand: 1,
          avgSkillLoad: { $round: ["$avgSkillLoad", 1] },
          yoeBandCount: { $size: "$yoeBands" },
        },
      },
      { $sort: { demand: -1, avgSkillLoad: -1, title: 1 } },
      { $limit: 10 },
    ]),
    SkillsData.aggregate([
      {
        $group: {
          _id: {
            yoeLabel: "$yoeLabel",
            yoeMin: "$yoeMin",
            yoeMax: "$yoeMax",
          },
          demand: { $sum: 1 },
          uniqueSkills: { $addToSet: "$skill" },
          uniqueRoles: { $addToSet: "$normalizedTitle" },
        },
      },
      {
        $project: {
          _id: 0,
          yoeRange: "$_id.yoeLabel",
          yoeMin: "$_id.yoeMin",
          yoeMax: "$_id.yoeMax",
          demand: 1,
          uniqueSkillsCount: { $size: "$uniqueSkills" },
          uniqueRolesCount: { $size: "$uniqueRoles" },
        },
      },
      { $sort: { yoeMin: 1 } },
    ]),
  ]);

  const selectedSkill = normalizeSkill(focusSkill || topSkillsRaw[0]?.skill || "");

  const [spotlightTrendRaw, spotlightAdjacencyRaw, spotlightRolesRaw] = selectedSkill
    ? await Promise.all([
        SkillsData.aggregate([
          { $match: { skill: selectedSkill } },
          {
            $group: {
              _id: {
                yoeLabel: "$yoeLabel",
                yoeMin: "$yoeMin",
                yoeMax: "$yoeMax",
              },
              demand: { $sum: 1 },
              roleTitles: { $addToSet: "$normalizedTitle" },
            },
          },
          {
            $project: {
              _id: 0,
              yoeRange: "$_id.yoeLabel",
              yoeMin: "$_id.yoeMin",
              yoeMax: "$_id.yoeMax",
              demand: 1,
              roleCoverage: { $size: "$roleTitles" },
            },
          },
          { $sort: { yoeMin: 1 } },
        ]),
        (async () => {
          const spotlightJobIds = await SkillsData.distinct("jobId", { skill: selectedSkill });
          return SkillsData.aggregate([
            { $match: { jobId: { $in: spotlightJobIds }, skill: { $ne: selectedSkill } } },
            {
              $group: {
                _id: "$skill",
                count: { $sum: 1 },
                roles: { $addToSet: "$normalizedTitle" },
              },
            },
            {
              $project: {
                _id: 0,
                skill: "$_id",
                count: 1,
                roleCoverage: { $size: "$roles" },
              },
            },
            { $sort: { count: -1, roleCoverage: -1, skill: 1 } },
            { $limit: 8 },
          ]);
        })(),
        SkillsData.aggregate([
          { $match: { skill: selectedSkill } },
          {
            $group: {
              _id: "$normalizedTitle",
              title: { $first: "$title" },
              demand: { $sum: 1 },
              yoeBands: { $addToSet: "$yoeLabel" },
            },
          },
          {
            $project: {
              _id: 0,
              title: "$title",
              normalizedTitle: "$_id",
              demand: 1,
              yoeBandCount: { $size: "$yoeBands" },
            },
          },
          { $sort: { demand: -1, yoeBandCount: -1, title: 1 } },
          { $limit: 6 },
        ]),
      ])
    : [[], [], []];

  const learningItems = selectedSkill ? getCatalogEntriesForSkill(selectedSkill).slice(0, 6) : [];
  const topSkills = buildTopSkillSeries(topSkillsRaw);
  const roleFamilies = roleFamiliesRaw;
  const yoeDistribution = sortYoeLabels(yoeDistributionRaw);
  const spotlightTrend = sortYoeLabels(spotlightTrendRaw);
  const spotlightPeak = [...spotlightTrend].sort((a, b) => (b.demand || 0) - (a.demand || 0))[0] || null;
  const narrative = buildGlobalNarrative({
    spotlightSkill: selectedSkill,
    topSkills,
    roleFamilies,
    yoeDistribution,
  });

  return {
    dataset: {
      datasetVersion: validationSummary?.datasetVersion || null,
      benchmarkJobCount: validationSummary?.cleaned?.jobPostingCount || 0,
      skillFactCount: validationSummary?.cleaned?.skillFactCount || 0,
      courseCatalogCount: validationSummary?.cleaned?.courseCatalogCount || 0,
      retainedRowRate: Math.round((validationSummary?.quality?.retainedRowRate || 0) * 100),
    },
    overview: narrative,
    summary: {
      topSkill: topSkills[0]?.skill || null,
      topSkillDemand: topSkills[0]?.demand || 0,
      topRoleFamily: roleFamilies[0]?.title || null,
      topRoleFamilyDemand: roleFamilies[0]?.demand || 0,
      busiestYoeBand: yoeDistribution[0]?.yoeRange || null,
      spotlightSkill: selectedSkill || null,
      spotlightPeakBand: spotlightPeak?.yoeRange || null,
    },
    topSkills,
    roleFamilies,
    yoeDistribution,
    spotlight: {
      skill: selectedSkill || null,
      trend: spotlightTrend,
      relatedSkills: spotlightAdjacencyRaw,
      topRoles: spotlightRolesRaw,
      learningOptions: learningItems.map((item) => ({
        title: item.title,
        provider: item.provider,
        format: item.format,
        estimatedWeeks: item.estimated_weeks,
        level: item.level,
        url: item.url,
      })),
    },
    methodology: {
      version: "global-market-intelligence-v1",
      dataModel:
        "Global trends are built from processed benchmark job postings and skill facts, then connected to the normalized course catalog for actionability.",
      skillDemand:
        "Skill demand = total benchmark skill facts for the canonical skill, with role coverage and posting coverage reported alongside frequency.",
      roleDemand:
        "Role-family demand groups normalized titles and reports average tracked skill load per role profile.",
      spotlight:
        "The spotlight view combines demand by experience band, role co-occurrence, top requiring roles, and linked learning options for the selected skill.",
      datasetVersion: validationSummary?.datasetVersion || "unknown",
    },
  };
}

export async function buildUserMarketInsights(resume, focusSkill = null) {
  const latestAnalysis = readResumeField(resume, "latestAnalysis");
  const latestResumeQuality = readResumeField(resume, "latestResumeQuality");

  if (!latestAnalysis) {
    const error = new Error("Run resume analysis before opening market analytics");
    error.statusCode = 409;
    throw error;
  }

  const resumeSkills = resume.extracted?.skills || [];
  const resumeYears = estimateResumeExperienceYears(resume.extracted?.experience || []);
  const candidateBand = getTargetYoeBandFromYears(resumeYears || 0);
  const roadmap = buildEvidenceBackedRoadmap(
    buildRoadmapInputs(resume, latestAnalysis, focusSkill)
  );
  const selectedSkill = roadmap.focusSkill || roadmap.priorityRanking?.[0]?.skill || null;
  const focusMeta =
    roadmap.priorityRanking.find((item) => item.skill === selectedSkill) ||
    roadmap.priorityRanking[0] ||
    null;
  const jobs = await getJobSuggestionsForResume(resume, 5);
  const roleImpact = buildRoleImpactSeries({
    jobs,
    resumeSkills,
    resumeYears,
    focusSkill: selectedSkill,
  });
  const targetBand =
    latestAnalysis.match?.targetYoeBand ||
    latestAnalysis.extractedJobRequirements?.yoeLabel ||
    candidateBand;
  const demandCurve = buildDemandCurve(
    roadmap.selectedSkillInsights?.demandByYoe || [],
    candidateBand,
    targetBand
  );
  const resumeSkillSet = new Set(normalizeSkillList(resumeSkills));
  const maturity = buildMaturitySummary(latestAnalysis.match?.perSkillEvidence || []);
  const validationSummary = await getValidationSummary();
  const dataset = {
    datasetVersion: validationSummary?.datasetVersion || null,
    benchmarkJobCount: validationSummary?.cleaned?.jobPostingCount || 0,
    skillFactCount: validationSummary?.cleaned?.skillFactCount || 0,
    retainedRowRate: Math.round((validationSummary?.quality?.retainedRowRate || 0) * 100),
  };
  const narrative = buildNarrative({
    focusMeta,
    demandCurve,
    roleImpact,
    maturity,
    candidateBand,
    targetBand,
  });

  return {
    dataset,
    summary: {
      jobFitScore: latestAnalysis.match?.percentage || 0,
      resumeQualityScore: latestResumeQuality?.overallScore || 0,
      benchmarkReadySkills: maturity.readySkills,
      trackedSkills: maturity.totalSkills,
      focusSkill: selectedSkill,
      focusPriorityScore: focusMeta?.priorityScore || 0,
      expectedRoleLift: roleImpact.maxLift,
      candidateExperienceBand: candidateBand,
      targetExperienceBand: targetBand,
    },
    overview: narrative,
    priorityChart: (roadmap.priorityRanking || []).slice(0, 8).map((item) => ({
      skill: item.skill,
      priorityScore: item.priorityScore,
      priorityLabel: item.priorityLabel,
      roleNeedScore: item.targetRoleNeedScore,
      marketDemandScore: item.marketDemandScore,
      targetYoeDemandScore: item.targetYoeDemandScore,
      readinessScore: item.readinessScore,
      effortInverseScore: item.effortInverseScore,
      selected: item.skill === selectedSkill,
    })),
    focusSkillBreakdown: focusMeta
      ? {
          skill: focusMeta.skill,
          priorityScore: focusMeta.priorityScore,
          priorityLabel: focusMeta.priorityLabel,
          targetLevel: focusMeta.targetLevel,
          estimatedWeeks: focusMeta.estimatedWeeks,
          roleNeedScore: focusMeta.targetRoleNeedScore,
          marketDemandScore: focusMeta.marketDemandScore,
          targetYoeDemandScore: focusMeta.targetYoeDemandScore,
          readinessScore: focusMeta.readinessScore,
          effortInverseScore: focusMeta.effortInverseScore,
          reasons: focusMeta.selectedBecause || [],
        }
      : null,
    demandCurve: {
      skill: selectedSkill,
      ...demandCurve,
    },
    roleImpact: {
      skill: selectedSkill,
      averageLift: roleImpact.averageLift,
      maxLift: roleImpact.maxLift,
      roles: roleImpact.roles,
    },
    adjacency: {
      skill: selectedSkill,
      series: buildAdjacentSkillSeries(
        roadmap.selectedSkillInsights?.skillAdjacency || [],
        resumeSkillSet
      ),
    },
    maturity,
    roadmapLinkage: buildRoadmapLinkage(roadmap, selectedSkill),
    methodology: buildMethodologySnapshot(validationSummary),
  };
}
