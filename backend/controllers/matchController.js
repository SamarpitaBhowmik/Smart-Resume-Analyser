import Resume from "../models/Resume.js";
import Job from "../models/jobs.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function getEmbedding(text) {
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  return dot / (magA * magB);
}

export const matchResumeToJob = async (req, res) => {
  try {
    const { resumeId, jobId } = req.body;

    const resume = await Resume.findById(resumeId);
    const job = await Job.findById(jobId);

    if (!resume || !job)
      return res.status(404).json({ error: "Resume or Job not found" });

    // Embedding similarity
    const rVec = await getEmbedding(resume.extracted.skills.join(", "));
    const jVec = await getEmbedding(job.skills.join(", "));
    const similarity = cosineSimilarity(rVec, jVec);
    const matchPercent = Math.round(similarity * 100);

    // AI: Find missing skills
    const missingPrompt = `
    Job requires skills: ${job.skills}.
    Resume has skills: ${resume.extracted.skills}.
    Return only missing skills as a JSON array.
    `;
    const missingRes = await flashModel.generateContent(missingPrompt);
    const missingSkills = JSON.parse(missingRes.response.text());

    // AI: Upskilling plan
    const upskillPrompt = `
    Candidate is missing these skills: ${missingSkills}.
    Generate a JSON roadmap with:
    {
      "courses": [ { "skill": "", "platform": "", "url": "" } ],
      "projects": [ { "title": "", "description": "" } ],
      "timelineWeeks": ""
    }
    `;
    const upskillRes = await flashModel.generateContent(upskillPrompt);
    const upskillPlan = JSON.parse(upskillRes.response.text());

    res.json({
      match: matchPercent,
      matched: resume.extracted.skills,
      missing: missingSkills,
      upskillingPlan: upskillPlan,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
};