import Resume from "../models/Resume.js";
import SkillData from "../models/SkillsData.js";

import { getValidationSummary } from "./datasetPipeline.js";
import { analyzeResumeQualityFromExtracted } from "./resumeQuality.js";
import { getJobSuggestionsForResume } from "../controllers/analysisController.js";

const ALGORITHM_VERSION = "hybrid-v1";
const RESUME_QUALITY_VERSION = "resume-quality-v1";

function buildMethodologySummary() {
  return {
    matching:
      "Hybrid matching uses 0.50 skill coverage + 0.30 semantic similarity + 0.20 experience alignment, with exact-overlap and embeddings-only baselines retained for comparison.",
    resumeQuality:
      "Resume quality scoring uses 0.30 action verb strength + 0.40 measurable impact + 0.30 clarity/specificity and reports feedback at statement level.",
    datasetValidation:
      "Datasets are validated for required fields, duplicate rows, YOE normalization, title normalization, and skill normalization before they are used for recommendation or analytics.",
    versions: {
      algorithmVersion: ALGORITHM_VERSION,
      resumeQualityVersion: RESUME_QUALITY_VERSION,
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

  if (!resume.latestAnalysis) {
    const error = new Error("Run resume analysis before generating a report");
    error.status = 409;
    throw error;
  }

  const resumeQuality =
    resume.latestResumeQuality || analyzeResumeQualityFromExtracted(resume.extracted || {});
  const jobSuggestions = await getJobSuggestionsForResume(resume);
  const validationSummary = await getValidationSummary();
  const missingSkillDemand = await buildMissingSkillDemand(
    resume.latestAnalysis.match?.missingCanonicalSkills || resume.latestAnalysis.match?.missingSkills || []
  );
  const highestImpactMissingSkill = missingSkillDemand[0]?.skill || null;
  const missingSkillTrend = await buildSkillTrend(highestImpactMissingSkill);
  const relatedSkills = await buildRelatedSkills(highestImpactMissingSkill);

  const summary = {
    jobFitScore: resume.latestAnalysis.match?.percentage || 0,
    resumeQualityScore: resumeQuality.overallScore,
    bestFitRole: jobSuggestions[0]?.title || null,
    highestImpactMissingSkill,
  };

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      resumeId: String(resume._id),
      algorithmVersion: ALGORITHM_VERSION,
      resumeQualityVersion: RESUME_QUALITY_VERSION,
      datasetVersion: validationSummary.datasetVersion,
    },
    summary,
    resume: {
      name: resume.extracted?.name || "Not provided",
      skills: resume.extracted?.skills || [],
      experienceCount: Array.isArray(resume.extracted?.experience) ? resume.extracted.experience.length : 0,
      educationCount: Array.isArray(resume.extracted?.education) ? resume.extracted.education.length : 0,
    },
    analysis: resume.latestAnalysis,
    resumeQuality,
    recommendations: resume.latestAnalysis.upskillingPlan || {},
    jobs: jobSuggestions.slice(0, 8),
    marketEvidence: {
      missingSkillDemand,
      missingSkillTrend,
      relatedSkills,
      topRoleMatches: jobSuggestions.slice(0, 5).map((job) => ({
        title: job.title,
        finalScore: job.finalScore,
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
