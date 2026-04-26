import Resume from "../models/Resume.js";
import Job from "../models/jobs.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

import {
  buildHybridScore,
  buildJobExplanation,
  buildRecommendationConfidence,
  buildSkillComparison,
  computeDemandAlignment,
  computeExperienceAlignment,
  computeRoleCooccurrenceFit,
  computeSkillLevelFit,
  computeTitleAlignment,
  estimateResumeExperienceYears,
  getTargetYoeBandFromYears,
  normalizeSkillList,
} from "../utils/jobMatching.js";
import { analyzeResumeQualityFromExtracted } from "../utils/resumeQuality.js";
import { parseYoeRange } from "../utils/yoe.js";
import { extractJobRequirements } from "../utils/jobRequirementExtractor.js";
import { buildEvidenceBackedRoadmap } from "../utils/roadmapBuilder.js";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PRIMARY_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const FALLBACK_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_FALLBACK || "embedding-001";
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let embedModel = genAI.getGenerativeModel({ model: PRIMARY_EMBEDDING_MODEL });
let activeEmbeddingModelName = PRIMARY_EMBEDDING_MODEL;
let embeddingsUnavailable = false;
const flashModel = genAI.getGenerativeModel({ model: MODEL_NAME });
const embeddingCache = new Map();

async function generateContentWithFallback(prompt) {
  try {
    return await flashModel.generateContent(prompt);
  } catch (error) {
    const is404 = error.status === 404 || (error.message && error.message.includes("404"));
    if (is404 && MODEL_NAME !== "gemini-pro") {
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
      return fallbackModel.generateContent(prompt);
    }
    throw error;
  }
}

async function getEmbedding(text, cacheKey = null) {
  if (cacheKey && embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  try {
    if (embeddingsUnavailable) {
      const error = new Error("Embeddings unavailable for this API key/project");
      error.code = "EMBEDDINGS_UNAVAILABLE";
      throw error;
    }

    const result = await embedModel.embedContent(text);
    const embedding = result.embedding?.values || result.embedding || result;
    if (cacheKey) embeddingCache.set(cacheKey, embedding);
    return embedding;
  } catch (error) {
    const is404 = error?.status === 404 || (error?.message && error.message.includes("404"));
    if (is404 && PRIMARY_EMBEDDING_MODEL !== FALLBACK_EMBEDDING_MODEL) {
      embedModel = genAI.getGenerativeModel({ model: FALLBACK_EMBEDDING_MODEL });
      activeEmbeddingModelName = FALLBACK_EMBEDDING_MODEL;
      const retry = await embedModel.embedContent(text);
      const embedding = retry.embedding?.values || retry.embedding || retry;
      if (cacheKey) embeddingCache.set(cacheKey, embedding);
      return embedding;
    }

    if (is404) {
      embeddingsUnavailable = true;
      const unavailable = new Error(
        "Embeddings API/model not available (404). Falling back to non-embedding scoring."
      );
      unavailable.code = "EMBEDDINGS_UNAVAILABLE";
      throw unavailable;
    }

    throw error;
  }
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  const dot = vecA.reduce((acc, val, index) => acc + val * vecB[index], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function safeParseJSON(text, fallback = {}) {
  try {
    let clean = String(text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = clean.indexOf("{");
    const firstBracket = clean.indexOf("[");
    const start =
      (firstBrace !== -1 && firstBrace < firstBracket) || firstBracket === -1
        ? firstBrace
        : firstBracket;
    if (start !== -1) clean = clean.slice(start);
    const lastBrace = clean.lastIndexOf("}");
    const lastBracket = clean.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);
    if (end !== -1) clean = clean.slice(0, end + 1);
    return JSON.parse(clean);
  } catch (error) {
    console.error("JSON Parse Error:", error.message);
    return fallback;
  }
}

function extractTextFromGemini(response) {
  if (!response) return "";
  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    return response.candidates[0].content.parts[0].text;
  }
  if (response.text) return response.text;
  if (response.output_text) return response.output_text;
  if (response.candidates?.[0]?.content?.[0]?.text) {
    return response.candidates[0].content[0].text;
  }
  if (typeof response === "string") return response;
  return "";
}

function tokenizeText(text = "") {
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9.+#]+/)
      .filter((token) => token.length > 2)
  );
}

function approximateSemanticSimilarity(textA, textB) {
  const tokensA = tokenizeText(textA);
  const tokensB = tokenizeText(textB);
  if (!tokensA.size || !tokensB.size) return 0;

  let shared = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) shared += 1;
  });

  return Math.round((shared / new Set([...tokensA, ...tokensB]).size) * 100);
}

function extractYoeFromJobDescription(jobDescription = "") {
  const patterns = [
    /(\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?))/i,
    /(\d{1,2}\s*[-â€“]\s*\d{1,2}\s*(?:years?|yrs?))/i,
    /(\d{1,2}\+\s*(?:years?|yrs?))/i,
    /([A-Za-z]{3,}\s*-\s*\d{1,2})/i,
    /(\d{1,2}\s*-\s*[A-Za-z]{3,})/i,
  ];

  for (const pattern of patterns) {
    const match = String(jobDescription).match(pattern);
    if (match?.[1]) {
      const parsed = parseYoeRange(match[1]);
      if (parsed.valid) return parsed;
    }
  }

  return {
    min: 0,
    max: null,
    label: "0+",
    mid: 0,
    valid: true,
  };
}

function buildResumeEvidenceText(resume) {
  const extracted = resume.extracted || {};
  const skills = extracted.skills || [];
  const experience = Array.isArray(extracted.experience) ? extracted.experience : [];
  const projects = Array.isArray(extracted.projects) ? extracted.projects : [];

  const experienceText = experience
    .map((item) => {
      if (typeof item === "string") return item;
      return [item?.title, item?.company, item?.description, item?.duration].filter(Boolean).join(" ");
    })
    .join(" ");

  const projectText = projects
    .map((item) => {
      if (typeof item === "string") return item;
      return [item?.title, item?.description].filter(Boolean).join(" ");
    })
    .join(" ");

  return [skills.join(", "), experienceText, projectText].filter(Boolean).join(" ");
}

async function calculateSemanticSimilarityScore(sourceText, targetText, cacheKey) {
  try {
    const sourceEmbedding = await getEmbedding(sourceText, `semantic-source:${cacheKey}`);
    const targetEmbedding = await getEmbedding(targetText, `semantic-target:${cacheKey}`);
    return Math.round(cosineSimilarity(sourceEmbedding, targetEmbedding) * 100);
  } catch (error) {
    if (error.code === "EMBEDDINGS_UNAVAILABLE" || error?.status === 404) {
      return approximateSemanticSimilarity(sourceText, targetText);
    }
    throw error;
  }
}

async function extractSkillsFromJobDescriptionFallback(jobDescription) {
  const prompt = `
    Extract all technical skills, tools, frameworks, platforms, and important professional capabilities from this job description.
    Return ONLY a JSON array of skill names.

    Job description:
    ${jobDescription}
  `;

  const response = await generateContentWithFallback(prompt);
  const text = extractTextFromGemini(response.response);
  return safeParseJSON(text, []);
}

function buildAnalysisMethodology({
  extractionMethod,
  extractionConfidence,
  usedGeminiFallback,
  exactSkillCoverageScore,
  skillLevelFitScore,
  semanticScore,
  experienceScore,
  roleCooccurrenceFitScore,
}) {
  return {
    algorithmVersion: "hybrid-v2",
    formula:
      "Hybrid score = 0.35 exact skill coverage + 0.20 skill level fit + 0.20 semantic similarity + 0.15 experience alignment + 0.10 role co-occurrence fit",
    extractionMethodology:
      "Job requirements are extracted deterministically from benchmark skill aliases and role keywords first, with Gemini used only as a low-confidence fallback.",
    extraction: {
      extractionMethod,
      extractionConfidence,
      usedGeminiFallback,
    },
    componentScores: {
      exactSkillCoverageScore,
      skillLevelFitScore,
      semanticScore,
      experienceScore,
      roleCooccurrenceFitScore,
    },
    baselineScores: {
      exactOverlapOnly: exactSkillCoverageScore,
      embeddingsOnly: semanticScore,
    },
  };
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

function readResumeField(resume, key) {
  if (!resume) return undefined;
  if (typeof resume.get === "function") {
    const value = resume.get(key);
    if (value !== undefined) return value;
  }
  return resume[key];
}

function writeResumeField(resume, key, value) {
  if (!resume) return;
  if (typeof resume.set === "function") {
    resume.set(key, value, { strict: false });
  } else {
    resume[key] = value;
  }
  if (typeof resume.markModified === "function") {
    resume.markModified(key);
  }
}

async function scoreJobMatch(resume, job, resumeEmbeddingText, resumeEmbedding = null) {
  const resumeSkills = resume.extracted?.skills || [];
  const resumeExperienceYears = estimateResumeExperienceYears(resume.extracted?.experience || []);
  const skillComparison = buildSkillComparison(resumeSkills, job.skills || []);
  const targetYoeBand = job.yoeLabel || getTargetYoeBandFromYears(job.yoeMid || job.yoeMin || 0);
  const skillLevelFit = computeSkillLevelFit({
    resumeSkills,
    jobSkills: job.skills || [],
    resumeYears: resumeExperienceYears,
    roleTitles: [job.normalizedTitle || job.title],
    targetYoeLabel: targetYoeBand,
  });
  const experienceAlignment = computeExperienceAlignment(
    resumeExperienceYears,
    job.yoeMin,
    job.yoeMax
  );
  const roleCooccurrenceFit = computeRoleCooccurrenceFit({
    resumeSkills,
    roleTitle: job.normalizedTitle || job.title,
    targetYoeLabel: targetYoeBand,
  });
  const latestAnalysis = readResumeField(resume, "latestAnalysis");
  const titleAlignment = computeTitleAlignment({
    targetTitleCandidates: latestAnalysis?.extractedJobRequirements?.titleCandidates || [],
    jobTitle: job.title,
    jobNormalizedTitle: job.normalizedTitle,
  });
  const demandAlignment = computeDemandAlignment({
    matchedCanonical: skillComparison.matchedCanonical,
    missingCanonical: skillComparison.missingCanonical,
  });

  let semanticScore = approximateSemanticSimilarity(
    resumeEmbeddingText,
    `${job.title} ${(job.skills || []).join(" ")} ${job.description}`
  );
  if (resumeEmbedding) {
    try {
      const jobEmbedding = await getEmbedding(
        `${job.title}. ${(job.skills || []).join(", ")}. ${job.description}`,
        `job:${job.jobId}`
      );
      semanticScore = Math.round(cosineSimilarity(resumeEmbedding, jobEmbedding) * 100);
    } catch (error) {
      if (!(error.code === "EMBEDDINGS_UNAVAILABLE" || error?.status === 404)) {
        throw error;
      }
    }
  }

  const finalScore = buildHybridScore({
    exactSkillCoverageScore: skillComparison.exactSkillCoverageScore,
    skillLevelFitScore: skillLevelFit.score,
    semanticSimilarityScore: semanticScore,
    experienceAlignmentScore: experienceAlignment.score,
    roleCooccurrenceFitScore: roleCooccurrenceFit.score,
  });
  const recommendationScore = Math.round(
    finalScore * 0.7 + titleAlignment.score * 0.15 + demandAlignment.score * 0.15
  );
  const recommendationConfidence = buildRecommendationConfidence({
    exactSkillCoverageScore: skillComparison.exactSkillCoverageScore,
    skillLevelFitScore: skillLevelFit.score,
    experienceAlignmentScore: experienceAlignment.score,
    titleAlignmentScore: titleAlignment.score,
  });

  return {
    _id: job._id,
    jobId: job.jobId,
    title: job.title,
    normalizedTitle: job.normalizedTitle,
    company: job.company,
    location: job.location,
    description: job.description,
    skills: job.skills,
    source: job.source,
    experienceText: job.experienceText,
    yoeLabel: targetYoeBand,
    targetYoeBand,
    finalScore: recommendationScore,
    matchScore: recommendationScore,
    baseHybridScore: finalScore,
    exactSkillCoverageScore: skillComparison.exactSkillCoverageScore,
    skillCoverageScore: skillComparison.exactSkillCoverageScore,
    skillLevelFitScore: skillLevelFit.score,
    semanticScore,
    experienceScore: experienceAlignment.score,
    roleCooccurrenceFitScore: roleCooccurrenceFit.score,
    titleAlignmentScore: titleAlignment.score,
    demandAlignmentScore: demandAlignment.score,
    recommendationConfidence,
    matchedSkills: skillComparison.matchedSkills,
    missingSkills: skillComparison.missingSkills,
    semanticMatches: skillComparison.semanticMatches,
    perSkillEvidence: skillLevelFit.evidence,
    recommendationSignals: {
      titleAlignment,
      demandAlignment,
      recommendationConfidence,
    },
    baselineScores: {
      exactOverlapOnly: skillComparison.exactSkillCoverageScore,
      embeddingsOnly: semanticScore,
      baseHybridScore: finalScore,
    },
    explanation: buildJobExplanation({
      title: job.title,
      skillComparison,
      skillLevelFit,
      semanticSimilarityScore: semanticScore,
      experienceAlignment,
      roleCooccurrenceFit,
      titleAlignment,
      demandAlignment,
      recommendationConfidence,
    }),
  };
}

export async function getJobSuggestionsForResume(resume, limit = 10) {
  const resumeSkills = resume.extracted?.skills || [];
  if (!resumeSkills.length) return [];

  const allJobs = await Job.find().limit(1500);
  if (!allJobs.length) return [];

  const resumeEmbeddingText = buildResumeEvidenceText(resume);
  const resumeExperienceYears = estimateResumeExperienceYears(resume.extracted?.experience || []);

  const prelim = allJobs.map((job) => {
    const skillComparison = buildSkillComparison(resumeSkills, job.skills || []);
    const skillLevelFit = computeSkillLevelFit({
      resumeSkills,
      jobSkills: job.skills || [],
      resumeYears: resumeExperienceYears,
      roleTitles: [job.normalizedTitle || job.title],
      targetYoeLabel: job.yoeLabel,
    });
    const experienceAlignment = computeExperienceAlignment(
      resumeExperienceYears,
      job.yoeMin,
      job.yoeMax
    );
    const roleCooccurrenceFit = computeRoleCooccurrenceFit({
      resumeSkills,
      roleTitle: job.normalizedTitle || job.title,
      targetYoeLabel: job.yoeLabel,
    });

    const preScore = Math.round(
      skillComparison.exactSkillCoverageScore * 0.45 +
        skillLevelFit.score * 0.25 +
        experienceAlignment.score * 0.2 +
        roleCooccurrenceFit.score * 0.1
    );

    return {
      job,
      preScore,
    };
  });

  const shortlist = prelim.sort((a, b) => b.preScore - a.preScore).slice(0, 25);

  let resumeEmbedding = null;
  try {
    resumeEmbedding = await getEmbedding(resumeEmbeddingText, `resume:${resume._id}`);
  } catch (error) {
    if (!(error.code === "EMBEDDINGS_UNAVAILABLE" || error?.status === 404)) {
      throw error;
    }
  }

  const rankedJobs = await Promise.all(
    shortlist.map(({ job }) => scoreJobMatch(resume, job, resumeEmbeddingText, resumeEmbedding))
  );

  return rankedJobs
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if ((b.recommendationConfidence?.score || 0) !== (a.recommendationConfidence?.score || 0)) {
        return (b.recommendationConfidence?.score || 0) - (a.recommendationConfidence?.score || 0);
      }
      return (b.titleAlignmentScore || 0) - (a.titleAlignmentScore || 0);
    })
    .slice(0, limit);
}

export const analyzeResumeQuality = async (req, res) => {
  try {
    const { resumeId } = req.body;
    if (!resumeId) {
      return res.status(400).json({ error: "Resume ID is required" });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const resumeQuality = analyzeResumeQualityFromExtracted(resume.extracted || {});
    writeResumeField(resume, "latestResumeQuality", resumeQuality);
    await resume.save();

    res.json({
      success: true,
      resumeQuality,
      methodology: {
        version: "resume-quality-v1",
        formula:
          "Resume quality = 0.30 action verb strength + 0.40 measurable impact + 0.30 clarity/specificity",
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to analyze resume quality", details: error.message });
  }
};

export const analyzeResumeAndJob = async (req, res) => {
  try {
    const { resumeId, jobDescription } = req.body;

    if (!resumeId) {
      return res.status(400).json({ error: "Resume ID is required" });
    }

    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ error: "Job description is required" });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const extractedYoe = extractYoeFromJobDescription(jobDescription);
    const extractedRequirements = await extractJobRequirements(
      jobDescription,
      extractSkillsFromJobDescriptionFallback
    );
    const resumeSkills = resume.extracted?.skills || [];
    const resumeCanonicalSkills = normalizeSkillList(resumeSkills);
    const skillComparison = buildSkillComparison(resumeSkills, extractedRequirements.skills);
    const resumeExperienceYears = estimateResumeExperienceYears(resume.extracted?.experience || []);
    const targetYoeBand = getTargetYoeBandFromYears(
      Number.isFinite(extractedYoe.mid) ? extractedYoe.mid : resumeExperienceYears
    );
    const skillLevelFit = computeSkillLevelFit({
      resumeSkills,
      jobSkills: extractedRequirements.skills,
      resumeYears: resumeExperienceYears,
      roleTitles: extractedRequirements.titleCandidates,
      targetYoeLabel: targetYoeBand,
    });
    const experienceAlignment = computeExperienceAlignment(
      resumeExperienceYears,
      extractedYoe.min,
      extractedYoe.max
    );
    const roleCooccurrenceFit = computeRoleCooccurrenceFit({
      resumeSkills,
      roleTitle: extractedRequirements.titleCandidates[0] || "",
      targetYoeLabel: targetYoeBand,
    });
    const semanticScore = await calculateSemanticSimilarityScore(
      buildResumeEvidenceText(resume),
      jobDescription,
      `jd:${resumeId}:${jobDescription.slice(0, 80)}`
    );

    const matchPercent = buildHybridScore({
      exactSkillCoverageScore: skillComparison.exactSkillCoverageScore,
      skillLevelFitScore: skillLevelFit.score,
      semanticSimilarityScore: semanticScore,
      experienceAlignmentScore: experienceAlignment.score,
      roleCooccurrenceFitScore: roleCooccurrenceFit.score,
    });

    const resumeQuality = analyzeResumeQualityFromExtracted(resume.extracted || {});
    const roadmap = buildEvidenceBackedRoadmap({
      resumeCanonicalSkills,
      resumeYears: resumeExperienceYears,
      targetCanonicalSkills: extractedRequirements.canonicalSkills,
      missingCanonicalSkills: skillComparison.missingCanonical,
      targetYoeMin: extractedYoe.min,
      targetYoeMax: extractedYoe.max,
      targetTitleCandidates: extractedRequirements.titleCandidates,
    });

    const latestAnalysis = {
      analyzedAt: new Date().toISOString(),
      jobDescription,
      extractedJobRequirements: {
        yoeLabel: extractedYoe.label,
        yoeMin: extractedYoe.min,
        yoeMax: extractedYoe.max,
        canonicalSkills: extractedRequirements.canonicalSkills,
        displaySkills: extractedRequirements.skills,
        titleCandidates: extractedRequirements.titleCandidates,
        extractionMethod: extractedRequirements.extractionMethod,
        extractionConfidence: extractedRequirements.extractionConfidence,
        usedGeminiFallback: extractedRequirements.usedGeminiFallback,
      },
      methodology: buildAnalysisMethodology({
        extractionMethod: extractedRequirements.extractionMethod,
        extractionConfidence: extractedRequirements.extractionConfidence,
        usedGeminiFallback: extractedRequirements.usedGeminiFallback,
        exactSkillCoverageScore: skillComparison.exactSkillCoverageScore,
        skillLevelFitScore: skillLevelFit.score,
        semanticScore,
        experienceScore: experienceAlignment.score,
        roleCooccurrenceFitScore: roleCooccurrenceFit.score,
      }),
      match: {
        percentage: matchPercent,
        matchedSkills: skillComparison.matchedSkills,
        missingSkills: skillComparison.missingSkills,
        matchedCanonicalSkills: skillComparison.matchedCanonical,
        missingCanonicalSkills: skillComparison.missingCanonical,
        semanticMatches: skillComparison.semanticMatches,
        resumeSkills,
        jobSkills: extractedRequirements.skills,
        resumeCanonicalSkills,
        jobCanonicalSkills: skillComparison.jobCanonicalSkills,
        resumeExperienceYears,
        exactSkillCoverageScore: skillComparison.exactSkillCoverageScore,
        skillCoverageScore: skillComparison.exactSkillCoverageScore,
        skillLevelFitScore: skillLevelFit.score,
        semanticScore,
        experienceScore: experienceAlignment.score,
        roleCooccurrenceFitScore: roleCooccurrenceFit.score,
        perSkillEvidence: skillLevelFit.evidence,
        missingSkillEvidence: roadmap.priorityRanking,
        targetYoeBand,
      },
      skillPriorityRanking: roadmap.priorityRanking,
      roadmapMethodology: roadmap.methodology,
      upskillingPlan: roadmap,
    };
    writeResumeField(resume, "latestResumeQuality", resumeQuality);
    writeResumeField(resume, "latestAnalysis", latestAnalysis);
    await resume.save();

    res.json({
      success: true,
      match: latestAnalysis.match,
      upskillingPlan: roadmap,
      skillPriorityRanking: roadmap.priorityRanking,
      missingSkillEvidence: roadmap.priorityRanking,
      roadmapMethodology: roadmap.methodology,
      resumeQuality,
      methodology: latestAnalysis.methodology,
      resumeData: {
        name: resume.extracted?.name || "Not provided",
        skills: resumeSkills,
        experience: resume.extracted?.experience || [],
        education: resume.extracted?.education || [],
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({
      error: "Analysis failed",
      details: error.message,
    });
  }
};

export const getRoadmap = async (req, res) => {
  try {
    const { resumeId, focusSkill } = req.body;

    if (!resumeId) {
      return res.status(400).json({ error: "Resume ID is required" });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const latestAnalysis = readResumeField(resume, "latestAnalysis");

    if (!latestAnalysis) {
      return res.status(409).json({ error: "Run analysis before generating a roadmap" });
    }

    const roadmap = buildEvidenceBackedRoadmap(
      buildRoadmapInputs(resume, latestAnalysis, focusSkill)
    );
    const roleFitBreakdown = await getJobSuggestionsForResume(resume, 5);

    res.json({
      success: true,
      roadmap: {
        ...roadmap,
        selectedSkillInsights: {
          ...roadmap.selectedSkillInsights,
          roleFitBreakdown: roleFitBreakdown.map((job) => ({
            title: job.title,
            finalScore: job.finalScore,
            exactSkillCoverageScore: job.exactSkillCoverageScore,
            skillLevelFitScore: job.skillLevelFitScore,
            semanticScore: job.semanticScore,
            experienceScore: job.experienceScore,
            roleCooccurrenceFitScore: job.roleCooccurrenceFitScore,
          })),
        },
      },
      methodology: roadmap.methodology,
    });
  } catch (error) {
    console.error("Roadmap error:", error);
    res.status(500).json({
      error: "Failed to build roadmap",
      details: error.message,
    });
  }
};

export const getJobSuggestions = async (req, res) => {
  try {
    const { resumeId } = req.query;

    if (!resumeId) {
      return res.status(400).json({ error: "Resume ID is required" });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const jobs = await getJobSuggestionsForResume(resume);

    res.json({
      success: true,
      jobs,
      totalFound: jobs.length,
      methodology: {
        version: "hybrid-v2-recommendation",
        formula:
          "Base hybrid = 0.35 exact skill coverage + 0.20 skill level fit + 0.20 semantic similarity + 0.15 experience alignment + 0.10 role co-occurrence fit; recommendation score = 0.70 base hybrid + 0.15 title alignment + 0.15 demand alignment",
        embeddingModel: activeEmbeddingModelName,
      },
    });
  } catch (error) {
    console.error("Job suggestions error:", error);
    res.status(500).json({
      error: "Failed to get job suggestions",
      details: error.message,
    });
  }
};
