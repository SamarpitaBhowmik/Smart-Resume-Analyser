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

// Get embedding for semantic matching
async function getEmbedding(text) {
  try {
    const result = await embedModel.embedContent(text);
    // Handle different response structures
    if (result.embedding?.values) {
      return result.embedding.values;
    }
    if (result.embedding) {
      return result.embedding;
    }
    // Fallback for different API versions
    return result;
  } catch (error) {
    console.error("Embedding error:", error);
    throw error;
  }
}

// Calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Extract JSON safely from Gemini output
function safeParseJSON(text, fallback = {}) {
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
    console.error("JSON Parse Error:", err.message);
    return fallback;
  }
}

// Extract text from Gemini response
function extractTextFromGemini(response) {
  if (!response) return "";
  // Handle different response structures
  // Standard Gemini API response structure
  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    return response.candidates[0].content.parts[0].text;
  }
  // Alternative structures
  if (response.text) return response.text;
  if (response.output_text) return response.output_text;
  if (response.candidates?.[0]?.content?.[0]?.text) {
    return response.candidates[0].content[0].text;
  }
  if (typeof response === "string") return response;
  return "";
}

// Main analysis function
export const analyzeResumeAndJob = async (req, res) => {
  try {
    const { resumeId, jobDescription } = req.body;

    if (!resumeId) {
      return res.status(400).json({ error: "Resume ID is required" });
    }

    if (!jobDescription || jobDescription.trim().length === 0) {
      return res.status(400).json({ error: "Job description is required" });
    }

    // Get resume from database
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    // Extract skills from job description using Gemini
    const extractSkillsPrompt = `
      Extract all technical skills, tools, and technologies mentioned in this job description.
      Return ONLY a JSON array of skill names. Example: ["JavaScript", "React", "Node.js", "MongoDB"]
      
      Job Description:
      ${jobDescription}
      
      Return only the JSON array, no other text.
    `;

    const skillsResponse = await generateContentWithFallback(extractSkillsPrompt);
    const skillsText = extractTextFromGemini(skillsResponse.response);
    const jobSkills = safeParseJSON(skillsText, []);

    // Get resume skills
    const resumeSkills = resume.extracted?.skills || [];

    // Semantic matching for skill gap detection
    const resumeSkillsText = resumeSkills.join(", ") || "No skills found";
    const jobSkillsText = jobSkills.join(", ") || "No skills required";

    const resumeEmbedding = await getEmbedding(resumeSkillsText);
    const jobEmbedding = await getEmbedding(jobSkillsText);
    const similarity = cosineSimilarity(resumeEmbedding, jobEmbedding);
    const matchPercent = Math.round(similarity * 100);

    // Identify missing skills using semantic matching
    const missingSkillsPrompt = `
      Job requires these skills: ${JSON.stringify(jobSkills)}
      Resume has these skills: ${JSON.stringify(resumeSkills)}
      
      Identify which skills from the job requirements are missing in the resume.
      Consider semantic similarity (e.g., "JS" matches "JavaScript", "React.js" matches "React").
      
      Return ONLY a JSON array of missing skills. Example: ["Node.js", "Docker", "AWS"]
      If no skills are missing, return an empty array: []
    `;

    const missingResponse = await generateContentWithFallback(missingSkillsPrompt);
    const missingText = extractTextFromGemini(missingResponse.response);
    const missingSkills = safeParseJSON(missingText, []);

    // Find matched skills
    const matchedSkills = resumeSkills.filter(skill => 
      jobSkills.some(jobSkill => 
        skill.toLowerCase().includes(jobSkill.toLowerCase()) || 
        jobSkill.toLowerCase().includes(skill.toLowerCase())
      )
    );

    // Generate upskilling recommendations and roadmap
    let upskillingPlan = {};
    if (missingSkills.length > 0) {
      const upskillPrompt = `
        A candidate has these skills: ${JSON.stringify(resumeSkills)}
        They need to learn these missing skills for a job: ${JSON.stringify(missingSkills)}
        
        Create a personalized learning roadmap in this exact JSON format:
        {
          "timelineWeeks": "number of weeks as string",
          "courses": [
            {
              "skill": "skill name",
              "platform": "platform name (e.g., Coursera, Udemy, freeCodeCamp)",
              "title": "course title",
              "url": "example URL or platform search term",
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
              "url": "example URL",
              "skill": "related skill"
            }
          ]
        }
        
        Make it practical and actionable. Return ONLY valid JSON.
      `;

      const upskillResponse = await generateContentWithFallback(upskillPrompt);
      const upskillText = extractTextFromGemini(upskillResponse.response);
      upskillingPlan = safeParseJSON(upskillText, {
        timelineWeeks: "8",
        courses: [],
        projects: [],
        resources: []
      });
    }

    // Return comprehensive analysis
    res.json({
      success: true,
      match: {
        percentage: matchPercent,
        matchedSkills: matchedSkills,
        missingSkills: missingSkills,
        resumeSkills: resumeSkills,
        jobSkills: jobSkills
      },
      upskillingPlan: upskillingPlan,
      resumeData: {
        name: resume.extracted?.name || "Not provided",
        skills: resumeSkills,
        experience: resume.extracted?.experience || [],
        education: resume.extracted?.education || []
      }
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ 
      error: "Analysis failed", 
      details: error.message 
    });
  }
};

// Get job suggestions based on resume
export const getJobSuggestions = async (req, res) => {
  try {
    const { resumeId, limit = 10 } = req.query;

    if (!resumeId) {
      return res.status(400).json({ error: "Resume ID is required" });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const resumeSkills = resume.extracted?.skills || [];
    if (resumeSkills.length === 0) {
      return res.json({ jobs: [], message: "No skills found in resume" });
    }

    // Get all jobs from database
    const allJobs = await Job.find().limit(100); // Limit for performance

    // Calculate similarity for each job
    const resumeSkillsText = resumeSkills.join(", ");
    const resumeEmbedding = await getEmbedding(resumeSkillsText);

    const jobsWithScores = await Promise.all(
      allJobs.map(async (job) => {
        if (!job.skills || job.skills.length === 0) return null;
        
        const jobSkillsText = job.skills.join(", ");
        const jobEmbedding = await getEmbedding(jobSkillsText);
        const similarity = cosineSimilarity(resumeEmbedding, jobEmbedding);
        
        return {
          job: {
            _id: job._id,
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            skills: job.skills,
            postedAt: job.postedAt
          },
          matchScore: Math.round(similarity * 100)
        };
      })
    );

    // Filter out nulls and sort by match score
    const validJobs = jobsWithScores
      .filter(item => item !== null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      jobs: validJobs,
      totalFound: validJobs.length
    });
  } catch (error) {
    console.error("Job suggestions error:", error);
    res.status(500).json({ 
      error: "Failed to get job suggestions", 
      details: error.message 
    });
  }
};

