import Resume from "../models/Resume.js";
import Job from "../models/jobs.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

import {
  buildHybridScore,
  buildJobExplanation,
  buildSkillComparison,
  computeExperienceAlignment,
  estimateResumeExperienceYears,
} from "../utils/jobMatching.js";
import { analyzeResumeQualityFromExtracted } from "../utils/resumeQuality.js";
import { parseYoeRange } from "../utils/yoe.js";

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
    /(\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?))/i,
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

async function calculateSemanticSimilarityScore(sourceText, targetText, cacheKey) {
  try {
    const sourceEmbedding = await getEmbedding(sourceText, `resume:${sourceText}`);
    const targetEmbedding = await getEmbedding(targetText, cacheKey);
    return Math.round(cosineSimilarity(sourceEmbedding, targetEmbedding) * 100);
  } catch (error) {
    if (error.code === "EMBEDDINGS_UNAVAILABLE" || error?.status === 404) {
      return approximateSemanticSimilarity(sourceText, targetText);
    }
    throw error;
  }
}

function buildAnalysisMethodology(skillCoverageScore, semanticScore, experienceScore) {
  return {
    algorithmVersion: "hybrid-v1",
    formula:
      "Hybrid score = 0.50 * skill coverage + 0.30 * semantic similarity + 0.20 * experience alignment",
    componentScores: {
      skillCoverageScore,
      semanticScore,
      experienceScore,
    },
    baselineScores: {
      exactOverlapOnly: skillCoverageScore,
      embeddingsOnly: semanticScore,
    },
  };
}

async function extractSkillsFromJobDescription(jobDescription) {
  const prompt = `
    Extract all technical skills, tools, frameworks, and technologies from this job description.
    Return ONLY a JSON array of skill names.

    Job description:
    ${jobDescription}
  `;

  const response = await generateContentWithFallback(prompt);
  const text = extractTextFromGemini(response.response);
  return safeParseJSON(text, []);
}

async function generateUpskillingPlan(resumeSkills, missingSkills) {
  if (!missingSkills.length) {
    return {
      timelineWeeks: "0",
      courses: [],
      projects: [],
      resources: [],
    };
  }

  const prompt = `
    A candidate currently has these skills: ${JSON.stringify(resumeSkills)}
    They are missing these target skills: ${JSON.stringify(missingSkills)}

    Create a practical learning roadmap in this exact JSON format:
    {
      "timelineWeeks": "number of weeks as string",
      "courses": [
        {
          "skill": "skill name",
          "platform": "platform name",
          "title": "course title",
          "url": "platform search term or URL",
          "duration": "estimated duration",
          "priority": "High/Medium/Low"
        }
      ],
      "projects": [
        {
          "title": "project title",
          "description": "brief description",
          "skills": ["skill1", "skill2"],
          "difficulty": "Beginner/Intermediate/Advanced"
        }
      ],
      "resources": [
        {
          "type": "Article/Video/Tutorial",
          "title": "resource title",
          "url": "resource URL or search term",
          "skill": "related skill"
        }
      ]
    }

    Return ONLY valid JSON.
  `;

  const response = await generateContentWithFallback(prompt);
  const text = extractTextFromGemini(response.response);
  return safeParseJSON(text, {
    timelineWeeks: "8",
    courses: [],
    projects: [],
    resources: [],
  });
}

async function scoreJobMatch(resume, job, resumeEmbeddingText, resumeEmbedding = null) {
  const resumeSkills = resume.extracted?.skills || [];
  const skillComparison = buildSkillComparison(resumeSkills, job.skills || []);
  const resumeExperienceYears = estimateResumeExperienceYears(resume.extracted?.experience || []);
  const experienceAlignment = computeExperienceAlignment(
    resumeExperienceYears,
    job.yoeMin,
    job.yoeMax
  );

  let semanticScore = approximateSemanticSimilarity(resumeEmbeddingText, `${job.title} ${job.skills.join(" ")}`);
  if (resumeEmbedding) {
    try {
      const jobEmbedding = await getEmbedding(
        `${job.title}. ${job.skills.join(", ")}. ${job.description}`,
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
    skillCoverageScore: skillComparison.skillCoverageScore,
    semanticSimilarityScore: semanticScore,
    experienceAlignmentScore: experienceAlignment.score,
  });

  return {
    _id: job._id,
    jobId: job.jobId,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    skills: job.skills,
    source: job.source,
    experienceText: job.experienceText,
    yoeLabel: job.yoeLabel,
    finalScore,
    matchScore: finalScore,
    skillCoverageScore: skillComparison.skillCoverageScore,
    semanticScore,
    experienceScore: experienceAlignment.score,
    matchedSkills: skillComparison.matchedSkills,
    missingSkills: skillComparison.missingSkills,
    semanticMatches: skillComparison.semanticMatches,
    baselineScores: {
      exactOverlapOnly: skillComparison.skillCoverageScore,
      embeddingsOnly: semanticScore,
    },
    explanation: buildJobExplanation({
      title: job.title,
      skillComparison,
      semanticSimilarityScore: semanticScore,
      experienceAlignment,
    }),
  };
}

export async function getJobSuggestionsForResume(resume) {
  const resumeSkills = resume.extracted?.skills || [];
  if (!resumeSkills.length) return [];

  const allJobs = await Job.find().limit(1500);
  if (!allJobs.length) return [];

  const resumeEmbeddingText = resumeSkills.join(", ");
  const resumeExperienceYears = estimateResumeExperienceYears(resume.extracted?.experience || []);

  const prelim = allJobs.map((job) => {
    const skillComparison = buildSkillComparison(resumeSkills, job.skills || []);
    const experienceAlignment = computeExperienceAlignment(
      resumeExperienceYears,
      job.yoeMin,
      job.yoeMax
    );
    const preScore = Math.round(
      skillComparison.skillCoverageScore * 0.7 + experienceAlignment.score * 0.3
    );
    return {
      job,
      preScore,
      skillCoverageScore: skillComparison.skillCoverageScore,
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

  return rankedJobs.sort((a, b) => b.finalScore - a.finalScore).slice(0, 10);
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
    resume.latestResumeQuality = resumeQuality;
    await resume.save();

    res.json({
      success: true,
      resumeQuality,
      methodology: {
        version: "resume-quality-v1",
        formula:
          "Resume quality = 0.30 * action verb strength + 0.40 * measurable impact + 0.30 * clarity/specificity",
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

    const jobSkills = await extractSkillsFromJobDescription(jobDescription);
    const resumeSkills = resume.extracted?.skills || [];
    const skillComparison = buildSkillComparison(resumeSkills, jobSkills);
    const extractedYoe = extractYoeFromJobDescription(jobDescription);
    const resumeExperienceYears = estimateResumeExperienceYears(resume.extracted?.experience || []);
    const experienceAlignment = computeExperienceAlignment(
      resumeExperienceYears,
      extractedYoe.min,
      extractedYoe.max
    );
    const semanticScore = await calculateSemanticSimilarityScore(
      resumeSkills.join(", "),
      jobSkills.join(", "),
      `jd:${jobSkills.join("|")}`
    );

    const matchPercent = buildHybridScore({
      skillCoverageScore: skillComparison.skillCoverageScore,
      semanticSimilarityScore: semanticScore,
      experienceAlignmentScore: experienceAlignment.score,
    });

    const resumeQuality = analyzeResumeQualityFromExtracted(resume.extracted || {});
    const upskillingPlan = await generateUpskillingPlan(
      resumeSkills,
      skillComparison.missingSkills
    );

    resume.latestResumeQuality = resumeQuality;
    resume.latestAnalysis = {
      analyzedAt: new Date().toISOString(),
      jobDescription,
      extractedJobRequirements: {
        yoeLabel: extractedYoe.label,
        yoeMin: extractedYoe.min,
        yoeMax: extractedYoe.max,
      },
      methodology: buildAnalysisMethodology(
        skillComparison.skillCoverageScore,
        semanticScore,
        experienceAlignment.score
      ),
      match: {
        percentage: matchPercent,
        matchedSkills: skillComparison.matchedSkills,
        missingSkills: skillComparison.missingSkills,
        matchedCanonicalSkills: skillComparison.matchedCanonical,
        missingCanonicalSkills: skillComparison.missingCanonical,
        semanticMatches: skillComparison.semanticMatches,
        resumeSkills,
        jobSkills,
        skillCoverageScore: skillComparison.skillCoverageScore,
        semanticScore,
        experienceScore: experienceAlignment.score,
      },
      upskillingPlan,
    };
    await resume.save();

    res.json({
      success: true,
      match: resume.latestAnalysis.match,
      upskillingPlan,
      resumeQuality,
      methodology: resume.latestAnalysis.methodology,
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
        version: "hybrid-v1",
        formula:
          "Final score = 0.50 * skill coverage + 0.30 * semantic similarity + 0.20 * experience alignment",
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
