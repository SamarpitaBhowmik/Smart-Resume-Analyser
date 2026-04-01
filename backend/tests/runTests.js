import assert from "node:assert/strict";

import { transformRows } from "../utils/datasetPipeline.js";
import {
  buildHybridScore,
  buildSkillComparison,
  computeExperienceAlignment,
} from "../utils/jobMatching.js";
import { normalizeSkill, normalizeSkills, normalizeTitle } from "../utils/normaliseSkills.js";
import { analyzeResumeQualityFromExtracted } from "../utils/resumeQuality.js";
import { parseYoeRange } from "../utils/yoe.js";

let failed = false;

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

runTest("normalizeSkill collapses aliases", () => {
  assert.equal(normalizeSkill("JS"), "javascript");
  assert.equal(normalizeSkill("ReactJS"), "react");
  assert.equal(normalizeSkill("Node"), "node.js");
});

runTest("normalizeSkills removes noise and duplicates", () => {
  const result = normalizeSkills(
    "Python basics; JavaScript basics; Intro to NLP; Hugging Face basics; JS"
  );
  assert.deepEqual(result, ["python", "javascript", "nlp", "hugging face"]);
});

runTest("normalizeTitle removes generic role suffixes", () => {
  assert.equal(normalizeTitle("Senior Data Scientist Engineer"), "senior data scientist");
  assert.equal(normalizeTitle("Frontend Developer"), "frontend");
});

runTest("parseYoeRange handles standard numeric ranges", () => {
  const parsed = parseYoeRange("2-4 years");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.min, 2);
  assert.equal(parsed.max, 4);
  assert.equal(parsed.label, "2-4");
});

runTest("parseYoeRange handles plus-style ranges", () => {
  const parsed = parseYoeRange("5+ years");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.min, 5);
  assert.equal(parsed.max, null);
  assert.equal(parsed.label, "5+");
});

runTest("parseYoeRange normalizes month-like spreadsheet artifacts", () => {
  const parsed = parseYoeRange("03-May");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.min, 3);
  assert.equal(parsed.max, 5);
  assert.equal(parsed.label, "3-5");
});

runTest("parseYoeRange rejects invalid values", () => {
  const parsed = parseYoeRange("experienced candidate");
  assert.equal(parsed.valid, false);
  assert.equal(parsed.reason, "invalid_yoe");
});

runTest("buildSkillComparison preserves canonical matching evidence", () => {
  const result = buildSkillComparison(
    ["JS", "Nodejs", "ReactJS"],
    ["JavaScript", "Node", "React", "SQL"]
  );

  assert.equal(result.skillCoverageScore, 75);
  assert.deepEqual(result.missingSkills, ["SQL"]);
  assert.equal(result.semanticMatches.length, 3);
});

runTest("computeExperienceAlignment rewards in-range experience", () => {
  const result = computeExperienceAlignment(3, 2, 4);
  assert.equal(result.score, 100);
});

runTest("buildHybridScore follows the weighted formula", () => {
  const score = buildHybridScore({
    skillCoverageScore: 80,
    semanticSimilarityScore: 70,
    experienceAlignmentScore: 60,
  });
  assert.equal(score, 73);
});

runTest("resume quality scoring rewards quantified action-oriented bullets", () => {
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

runTest("transformRows drops missing fields, invalid YOE values, and duplicates", () => {
  const dataset = transformRows([
    { Title: "Data Scientist", YOE: "0-1 years", Skills: "Python, SQL" },
    { Title: "Data Scientist Engineer", YOE: "0-1 years", Skills: "Python, SQL" },
    { Title: "", YOE: "2+", Skills: "Python" },
    { Title: "Backend Developer", YOE: "experienced", Skills: "Node.js" },
    { Title: "Frontend Engineer", YOE: "03-May", Skills: "ReactJS, JavaScript" },
  ]);

  assert.equal(dataset.jobPostings.length, 2);
  assert.equal(dataset.validationSummary.cleaned.jobPostingCount, 2);
  assert.equal(dataset.validationSummary.quality.duplicateRowsRemoved, 1);
  assert.equal(dataset.validationSummary.quality.missingFieldRows, 1);
  assert.equal(dataset.validationSummary.quality.invalidYoeRows, 1);
  assert.equal(dataset.validationSummary.quality.retainedRowRate, 0.4);
  assert.equal(dataset.jobPostings[1].yoeLabel, "3-5");
  assert.deepEqual(dataset.jobPostings[1].skills, ["react", "javascript"]);
});

if (failed) {
  process.exit(1);
}
