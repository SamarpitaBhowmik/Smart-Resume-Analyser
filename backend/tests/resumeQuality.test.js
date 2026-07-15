import test from "node:test";
import assert from "node:assert/strict";

import { analyzeResumeQualityFromExtracted } from "../utils/resumeQuality.js";

test("resume quality scoring rewards quantified, action-oriented bullets", () => {
  const strong = analyzeResumeQualityFromExtracted({
    experience: [
      {
        description:
          "Built a React dashboard that improved reporting speed by 35% for 120 users.",
      },
    ],
  });

  const weak = analyzeResumeQualityFromExtracted({
    experience: [
      {
        description: "Worked on dashboard tasks and helped with reports.",
      },
    ],
  });

  assert.ok(strong.overallScore > weak.overallScore);
  assert.equal(strong.confidenceLabel, "High");
  assert.equal(weak.statements[0].flags.includes("missing_metrics"), true);
});
