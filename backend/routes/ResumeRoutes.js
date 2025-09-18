import express from "express";
import multer from "multer";
import Resume from "../models/Resume.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// AI-based resume parser
async function parseResumeAI(fileBuffer) {
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: fileBuffer.toString("base64"),
      },
    },
    {
      text: `
        You are an AI Resume Parser.
        Extract ONLY valid JSON in this exact structure:
        {
          "name": "",
          "skills": [],
          "experience": [],
          "projects": [],
          "education": []
        }
      `,
    },
  ]);

  // ✅ Safely extract text
  const rawText = result.response.candidates[0].content.parts[0].text.trim();

  // ✅ Ensure only JSON is parsed
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");

  return JSON.parse(jsonMatch[0]);
}

// POST /api/resume/upload
router.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const extracted = await parseResumeAI(req.file.buffer);

    const resume = new Resume({
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      data: req.file.buffer,
      extracted,
    });

    await resume.save();

    res.json({
      message: "Resume uploaded & AI-parsed successfully",
      extracted,
      id: resume._id, // send ID so frontend can match
    });
  } catch (error) {
    console.error("AI Resume Parsing Error:", error);
    res.status(500).json({ error: error.message || "AI parsing failed" });
  }
});

export default router;