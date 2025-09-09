import express from "express";
import Job from "../models/jobs.js";

const router = express.Router();

// GET /api/jobs → fetch all jobs
router.get("/", async (req, res) => {
  try {
    const jobs = await Job.find(); // fetch all documents from jobs collection
    res.json(jobs);                // send as JSON response
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs/:id → fetch single job by ID
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
