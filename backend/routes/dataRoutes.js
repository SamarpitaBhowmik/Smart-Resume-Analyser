import express from "express";

import { getValidationSummary } from "../utils/datasetPipeline.js";

const router = express.Router();

router.get("/validation-summary", async (req, res) => {
  try {
    const summary = await getValidationSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
