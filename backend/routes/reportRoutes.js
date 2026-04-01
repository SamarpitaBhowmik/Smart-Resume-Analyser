import express from "express";

import {
  downloadResearchReportPdf,
  getResearchReport,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/:resumeId", getResearchReport);
router.get("/:resumeId/pdf", downloadResearchReportPdf);

export default router;
