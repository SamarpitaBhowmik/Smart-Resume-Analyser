import Resume from "../models/Resume.js";
import Job from "../models/jobs.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
// Use model from env, or try gemini-2.5-flash (same as ResumeRoutes), with fallback to gemini-pro
// If you get 404 errors, set GEMINI_MODEL=gemini-pro in your .env file
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const flashModel = genAI.getGenerativeModel({ model: MODEL_NAME });

// Helper function to generate content with fallback
async function generateContentWithFallback(prompt) {
  try {
    return await flashModel.generateContent(prompt);
  } catch (error) {
    // If model not found (404), try fallback to gemini-pro
    const is404 = error.status === 404 || (error.message && error.message.includes('404'));
    if (is404 && MODEL_NAME !== "gemini-pro") {
      console.warn(`Model ${MODEL_NAME} not found, trying gemini-pro as fallback`);
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        return await fallbackModel.generateContent(prompt);
      } catch (fallbackError) {
        console.error("Fallback model also failed:", fallbackError.message);
        throw new Error(`Both ${MODEL_NAME} and gemini-pro models failed. Please check your API key and available models.`);
      }
    }
    throw error;
  }
}

async function getEmbedding(text) {
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val, i) => acc + val * val, 0));
  return dot / (magA * magB);
}

// Extract JSON safely from Gemini output
function safeParseJSON(text, fallback = []) {
  try {
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const firstBrace = clean.indexOf("{");
    const firstBracket = clean.indexOf("[");
    const start = (firstBrace !== -1 && firstBrace < firstBracket) || firstBracket === -1
      ? firstBrace
      : firstBracket;
    if (start !== -1) clean = clean.slice(start);

    const lastBrace = clean.lastIndexOf("}");
    const lastBracket = clean.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);
    if (end !== -1) clean = clean.slice(0, end + 1);

    return JSON.parse(clean);
  } catch (err) {
    console.error("❌ JSON Parse Error:", err.message, "on text:", text);
    return fallback;
  }
}

// Extract plain text from Gemini response safely
function extractTextFromGemini(response) {
  if (!response) return "";
  if (response.output_text) return response.output_text;
  if (response.candidates?.[0]?.content?.[0]?.text) return response.candidates[0].content[0].text;
  if (typeof response === "string") return response;
  return "";
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

    // Missing skills
    const missingPrompt = `
      Job requires skills: ${job.skills}.
      Resume has skills: ${resume.extracted.skills}.
      Return only the missing skills as a JSON array. Example: ["Python", "Django"].
    `;
    const missingRes = await generateContentWithFallback(missingPrompt);
    const missingText = extractTextFromGemini(missingRes.response);
    const missingSkills = safeParseJSON(missingText, []);

    //  Upskilling plan (only if missing exists)
    let upskillPlan = [];
    if (missingSkills.length > 0) {
      const upskillPrompt = `
        Candidate is missing: ${missingSkills}.
        Create a JSON roadmap:
        {
          "courses": [ { "skill": "Python", "platform": "Coursera", "url": "https://..." } ],
          "projects": [ { "title": "Build a Django App", "description": "..." } ],
          "timelineWeeks": "12"
        }
      `;
      const upskillRes = await generateContentWithFallback(upskillPrompt);
      const upskillText = extractTextFromGemini(upskillRes.response);
      upskillPlan = safeParseJSON(upskillText, []);
    }

    res.json({
      match: matchPercent,
      matched: resume.extracted.skills,
      missing: missingSkills,
      upskillingPlan: upskillPlan,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};
