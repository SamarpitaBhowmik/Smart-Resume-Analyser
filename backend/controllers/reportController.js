import { buildResearchReport } from "../utils/reportBuilder.js";
import { buildPdfFromReport } from "../utils/pdfReport.js";

export const getResearchReport = async (req, res) => {
  try {
    const report = await buildResearchReport(req.params.resumeId);
    res.json({
      success: true,
      report,
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || "Failed to build research report",
    });
  }
};

export const downloadResearchReportPdf = async (req, res) => {
  try {
    const report = await buildResearchReport(req.params.resumeId);
    const pdf = buildPdfFromReport(report);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="careeralign-report-${req.params.resumeId}.pdf"`
    );
    res.send(pdf);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || "Failed to generate report PDF",
    });
  }
};
