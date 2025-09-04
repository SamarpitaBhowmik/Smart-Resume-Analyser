import express from "express";
import multer from "multer";
import PDFParser from "pdf2json";
import Resume from "../models/Resume.js";

const router = express.Router();

// Multer config (store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// parse PDF buffer → extract text
const parsePDF = (buffer) => {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (err) => reject(err.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      
      const text = pdfData.Pages.map((page) =>
        page.Texts.map((t) => decodeURIComponent(t.R[0].T)).join(" ")
      ).join("\n");

      resolve(text);
    });

    pdfParser.parseBuffer(buffer);
  });
};

// Regex extractors
const extractEmail = (text) => {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
  return match ? match[0] : null;
};

const extractPhone = (text) => {
  const match = text.match(/(\+?\d{1,3})?[\s-]?\d{10}/);
  return match ? match[0] : null;
};

const extractSkills = (text) => {
  const skillsList = ["JavaScript", "React", "Node.js", "MongoDB", "Python", "Java", "C++"];
  return skillsList.filter((skill) => text.toLowerCase().includes(skill.toLowerCase()));
};

// POST /api/resume/upload
router.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const text = await parsePDF(req.file.buffer);

    const email = extractEmail(text);
    const phone = extractPhone(text);
    const skills = extractSkills(text);

    const resume = new Resume({
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      data: req.file.buffer,
      extracted: { text, email, phone, skills },
    });

    await resume.save();

    res.json({
      message: "Resume uploaded & parsed successfully",
      email,
      phone,
      skills,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
