import Resume from "../models/Resume.js";
import SkillData from "../models/SkillsData.js";

import { getValidationSummary } from "./datasetPipeline.js";
import { analyzeResumeQualityFromExtracted } from "./resumeQuality.js";
import { buildEvidenceBackedRoadmap } from "./roadmapBuilder.js";
import { getJobSuggestionsForResume } from "../controllers/analysisController.js";

const ALGORITHM_VERSION = "hybrid-v2";
const RESUME_QUALITY_VERSION = "resume-quality-v1";
const ROADMAP_VERSION = "roadmap-v2";

function readResumeField(resume, key) {
  if (!resume) return undefined;
  if (typeof resume.get === "function") {
    const value = resume.get(key);
    if (value !== undefined) return value;
  }
  return resume[key];
}

function buildMethodologySummary() {
  return {
    matching:
      "Hybrid matching uses 0.35 exact skill coverage + 0.20 skill level fit + 0.20 semantic similarity + 0.15 experience alignment + 0.10 role co-occurrence fit, with exact-overlap and embeddings-only baselines retained for comparison.",
    resumeQuality:
      "Resume quality scoring uses 0.30 action verb strength + 0.40 measurable impact + 0.30 clarity/specificity and reports feedback at statement level.",
    roadmap:
      "Roadmap items are selected from a curated course catalog and ranked deterministically using missing-skill priority, level fit, provider trust, and hands-on value.",
    datasetValidation:
      "Datasets are validated for required fields, duplicate rows, YOE normalization, title normalization, and skill normalization before they are used for recommendation or analytics.",
    versions: {
      algorithmVersion: ALGORITHM_VERSION,
      resumeQualityVersion: RESUME_QUALITY_VERSION,
      roadmapVersion: ROADMAP_VERSION,
    },
  };
}

async function buildMissingSkillDemand(missingSkills = []) {
  if (!missingSkills.length) return [];

  const canonicalSkills = missingSkills.map((skill) => String(skill).toLowerCase());
  return SkillData.aggregate([
    { $match: { skill: { $in: canonicalSkills } } },
    {
      $group: {
        _id: "$skill",
        demand: { $sum: 1 },
        roles: { $addToSet: "$normalizedTitle" },
      },
    },
    {
      $project: {
        _id: 0,
        skill: "$_id",
        demand: 1,
        roleCount: { $size: "$roles" },
      },
    },
    { $sort: { demand: -1 } },
    { $limit: 8 },
  ]);
}

async function buildSkillTrend(skill) {
  if (!skill) return [];

  return SkillData.aggregate([
    { $match: { skill: String(skill).toLowerCase() } },
    {
      $group: {
        _id: { yoeLabel: "$yoeLabel", yoeMin: "$yoeMin" },
        demand: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        yoeRange: "$_id.yoeLabel",
        yoeMin: "$_id.yoeMin",
        demand: 1,
      },
    },
    { $sort: { yoeMin: 1 } },
  ]);
}

async function buildRelatedSkills(skill) {
  if (!skill) return [];

  const roles = await SkillData.distinct("jobId", { skill: String(skill).toLowerCase() });
  if (!roles.length) return [];

  return SkillData.aggregate([
    { $match: { jobId: { $in: roles } } },
    { $group: { _id: "$skill", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
    {
      $project: {
        _id: 0,
        skill: "$_id",
        count: 1,
      },
    },
  ]);
}

export async function buildResearchReport(resumeId) {
  const resume = await Resume.findById(resumeId);
  if (!resume) {
    const error = new Error("Resume not found");
    error.status = 404;
    throw error;
  }

  const latestAnalysis = readResumeField(resume, "latestAnalysis");
  const latestResumeQuality = readResumeField(resume, "latestResumeQuality");

  if (!latestAnalysis) {
    const error = new Error("Run resume analysis before generating a report");
    error.status = 409;
    throw error;
  }

  const resumeQuality =
    latestResumeQuality || analyzeResumeQualityFromExtracted(resume.extracted || {});
  const jobSuggestions = await getJobSuggestionsForResume(resume);
  const validationSummary = await getValidationSummary();
  const roadmap =
    latestAnalysis.upskillingPlan ||
    buildEvidenceBackedRoadmap({
      resumeCanonicalSkills: latestAnalysis.match?.resumeCanonicalSkills || [],
      resumeYears: latestAnalysis.match?.resumeExperienceYears || null,
      targetCanonicalSkills: latestAnalysis.extractedJobRequirements?.canonicalSkills || [],
      missingCanonicalSkills: latestAnalysis.match?.missingCanonicalSkills || [],
      targetYoeMin: latestAnalysis.extractedJobRequirements?.yoeMin ?? 0,
      targetYoeMax: latestAnalysis.extractedJobRequirements?.yoeMax ?? null,
      targetTitleCandidates: latestAnalysis.extractedJobRequirements?.titleCandidates || [],
    });
  const missingSkillDemand = await buildMissingSkillDemand(
    latestAnalysis.match?.missingCanonicalSkills || latestAnalysis.match?.missingSkills || []
  );
  const highestImpactMissingSkill = missingSkillDemand[0]?.skill || null;
  const missingSkillTrend = await buildSkillTrend(highestImpactMissingSkill);
  const relatedSkills = await buildRelatedSkills(highestImpactMissingSkill);

  const summary = {
    jobFitScore: latestAnalysis.match?.percentage || 0,
    resumeQualityScore: resumeQuality.overallScore,
    bestFitRole: jobSuggestions[0]?.title || null,
    highestImpactMissingSkill,
    matchedSkills: latestAnalysis.match?.matchedSkills || [],
    missingSkills: latestAnalysis.match?.missingSkills || [],
  };

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      resumeId: String(resume._id),
      algorithmVersion: ALGORITHM_VERSION,
      resumeQualityVersion: RESUME_QUALITY_VERSION,
      roadmapVersion: ROADMAP_VERSION,
      datasetVersion: validationSummary.datasetVersion,
    },
    summary,
    resume: {
      name: resume.extracted?.name || "Not provided",
      skills: resume.extracted?.skills || [],
      experienceCount: Array.isArray(resume.extracted?.experience) ? resume.extracted.experience.length : 0,
      educationCount: Array.isArray(resume.extracted?.education) ? resume.extracted.education.length : 0,
    },
    matchedSkills: latestAnalysis.match?.matchedSkills || [],
    missingSkills: latestAnalysis.match?.missingSkills || [],
    analysis: latestAnalysis,
    resumeQuality,
    recommendations: roadmap,
    jobs: jobSuggestions.slice(0, 8),
    marketEvidence: {
      priorityRanking: latestAnalysis.skillPriorityRanking || roadmap.priorityRanking || [],
      missingSkillDemand,
      missingSkillTrend,
      relatedSkills,
      topRoleMatches: jobSuggestions.slice(0, 5).map((job) => ({
        title: job.title,
        finalScore: job.finalScore,
        exactSkillCoverageScore: job.exactSkillCoverageScore,
        skillLevelFitScore: job.skillLevelFitScore,
        semanticScore: job.semanticScore,
        experienceScore: job.experienceScore,
        roleCooccurrenceFitScore: job.roleCooccurrenceFitScore,
      })),
    },
    validationSummary: {
      datasetVersion: validationSummary.datasetVersion,
      retainedRowRate: validationSummary.quality.retainedRowRate,
      droppedRowCount: validationSummary.quality.droppedRowCount,
      duplicateRowsRemoved: validationSummary.quality.duplicateRowsRemoved,
      invalidYoeRows: validationSummary.quality.invalidYoeRows,
    },
    methodology: buildMethodologySummary(),
    resultsSummary: {
      narrative: `The candidate currently scores ${summary.jobFitScore}% against the supplied job description and ${summary.resumeQualityScore}% on resume communication quality. ${summary.bestFitRole ? `${summary.bestFitRole} emerges as the strongest benchmark role.` : "A benchmark role could not be determined from the current dataset."}`,
      interpretation: highestImpactMissingSkill
        ? `${highestImpactMissingSkill} is the highest-impact missing skill in the current market benchmark, so it should be prioritized in the learning roadmap.`
        : "No missing-skill market hotspot was identified from the latest analysis.",
    },
  };
}
