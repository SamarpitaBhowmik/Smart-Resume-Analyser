import express from "express";
import { matchResumeToJob } from "../controllers/matchController.js";

const router = express.Router();

// POST /api/match
router.post("/", matchResumeToJob);

export default router;
