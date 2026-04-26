import express from "express";
import {
  analyzeResumeAndJob,
  analyzeResumeQuality,
  getRoadmap,
  getJobSuggestions,
} from "../controllers/analysisController.js";

const router = express.Router();

// POST /api/analysis/analyze - Analyze resume against job description
router.post("/analyze", analyzeResumeAndJob);
router.post("/resume-quality", analyzeResumeQuality);
router.post("/roadmap", getRoadmap);

// GET /api/analysis/job-suggestions - Get job suggestions based on resume
router.get("/job-suggestions", getJobSuggestions);

export default router;

