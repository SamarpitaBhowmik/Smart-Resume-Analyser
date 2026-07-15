import assert from "node:assert/strict";

import { transformRows } from "../utils/datasetPipeline.js";
import { extractJobRequirements } from "../utils/jobRequirementExtractor.js";
import {
  buildHybridScore,
  buildJobExplanation,
  buildRecommendationConfidence,
  buildSkillComparison,
  computeDemandAlignment,
  computeExperienceAlignment,
  computeTitleAlignment,
} from "../utils/jobMatching.js";
import { normalizeSkill, normalizeSkills, normalizeTitle } from "../utils/normaliseSkills.js";
import { buildEvidenceBackedRoadmap } from "../utils/roadmapBuilder.js";
import { analyzeResumeQualityFromExtracted } from "../utils/resumeQuality.js";
import { buildSkillPriorityRanking } from "../utils/skillPriorityEngine.js";
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

async function runAsyncTest(name, fn) {
  try {
    await fn();
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
    exactSkillCoverageScore: 80,
    skillLevelFitScore: 70,
    semanticSimilarityScore: 60,
    experienceAlignmentScore: 50,
    roleCooccurrenceFitScore: 40,
  });
  assert.equal(score, 66);
});

runTest("computeTitleAlignment rewards target role family overlap", () => {
  const result = computeTitleAlignment({
    targetTitleCandidates: ["data analyst", "business intelligence analyst"],
    jobTitle: "Data Analyst",
    jobNormalizedTitle: "data analyst",
  });

  assert.ok(result.score >= 75);
});

runTest("computeDemandAlignment favors stronger matched-demand coverage", () => {
  const result = computeDemandAlignment({
    matchedCanonical: ["python", "sql"],
    missingCanonical: ["tableau"],
  });

  assert.ok(result.score > 40);
});

runTest("buildRecommendationConfidence summarizes suggestion confidence", () => {
  const result = buildRecommendationConfidence({
    exactSkillCoverageScore: 82,
    skillLevelFitScore: 76,
    experienceAlignmentScore: 88,
    titleAlignmentScore: 91,
  });

  assert.ok(result.score >= 80);
  assert.equal(result.label, "High confidence");
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
  ], [
    {
      Title: "Applied SQL Analytics",
      URL: "https://example.com/sql",
      "Short Intro": "Build dashboards with SQL and Tableau",
      Skills: "SQL, Tableau, Dashboards",
      "Course Type": "Guided Project",
      Level: "Beginner",
      Duration: "Approximately 2 weeks to complete",
      Site: "Coursera",
      Prequisites: "Excel basics",
    },
    {
      Title: "Applied SQL Analytics",
      URL: "https://example.com/sql",
      Skills: "SQL, Tableau",
      "Course Type": "Guided Project",
      Site: "Coursera",
    },
    {
      Title: "",
      URL: "https://example.com/missing-title",
      Skills: "Python",
    },
    {
      Title: "Machine Learning Foundations",
      URL: "https://example.com/ml",
      Category: "Data Science",
      "Sub-Category": "Machine Learning",
      Skills: "",
      "Course Type": "Specialization",
      Site: "Coursera",
    },
  ]);

  assert.equal(dataset.jobPostings.length, 2);
  assert.equal(dataset.validationSummary.cleaned.jobPostingCount, 2);
  assert.equal(dataset.validationSummary.datasets.courses.cleaned.rawCourseCount, 2);
  assert.equal(dataset.validationSummary.quality.duplicateRowsRemoved, 1);
  assert.equal(dataset.validationSummary.quality.missingFieldRows, 1);
  assert.equal(dataset.validationSummary.quality.invalidYoeRows, 1);
  assert.equal(dataset.validationSummary.datasets.courses.quality.duplicateRowsRemoved, 1);
  assert.equal(dataset.validationSummary.datasets.courses.quality.missingTitleRows, 1);
  assert.equal(dataset.validationSummary.datasets.courses.quality.inferredSkillRows, 1);
  assert.ok(dataset.validationSummary.consistency.sharedSkillCount >= 1);
  assert.equal(dataset.validationSummary.quality.retainedRowRate, 0.4);
  assert.equal(dataset.jobPostings[1].yoeLabel, "3-5");
  assert.deepEqual(dataset.jobPostings[1].skills, ["react", "javascript"]);
  assert.equal(dataset.courseCatalog[0].format, "project");
  assert.deepEqual(dataset.courseCatalog[0].skills_covered.slice(0, 2), ["sql", "tableau"]);
});

runTest("skill priority ranking keeps evidence for each missing skill", () => {
  const result = buildSkillPriorityRanking({
    missingCanonicalSkills: ["aws", "docker", "kubernetes"],
    targetCanonicalSkills: ["python", "docker", "aws", "kubernetes"],
    resumeCanonicalSkills: ["python", "git", "linux"],
    resumeYears: 1.5,
    targetYoeMin: 2,
    targetYoeMax: 4,
    targetTitleCandidates: ["devops engineer"],
    focusSkill: "aws",
  });

  assert.equal(result.ranking.length, 3);
  assert.ok(result.ranking.every((item) => typeof item.priorityScore === "number"));
  assert.ok(result.ranking.every((item) => item.selectedBecause.length > 0));
  assert.equal(result.focusSkill, "aws");
});

runTest("roadmap generation is deterministic and evidence-backed", () => {
  const input = {
    resumeCanonicalSkills: ["python", "sql", "git"],
    resumeYears: 1,
    targetCanonicalSkills: ["python", "sql", "tableau", "power bi"],
    missingCanonicalSkills: ["tableau", "power bi"],
    targetYoeMin: 1,
    targetYoeMax: 3,
    targetTitleCandidates: ["data analyst"],
    focusSkill: "tableau",
  };

  const first = buildEvidenceBackedRoadmap(input);
  const second = buildEvidenceBackedRoadmap(input);

  assert.deepEqual(first, second);
  assert.equal(first.focusSkill, "tableau");
  assert.ok(first.priorityRanking.length >= 1);
  assert.ok(
    [...first.courses, ...first.projects, ...first.resources].every(
      (item) => item.targetSkill && item.selectedBecause?.length
    )
  );
});

await runAsyncTest("job requirement extraction prefers deterministic extraction for common skills", async () => {
  const result = await extractJobRequirements(
    "We are hiring a Data Analyst with SQL, Tableau, Python, dashboards, and communication skills."
  );

  assert.ok(result.skills.length >= 3);
  assert.equal(result.usedGeminiFallback, false);
  assert.ok(result.extractionMethod.startsWith("deterministic"));
  // Verify contextual extraction
  assert.ok(result.skillsContext["sql"] !== undefined, "SQL context should be extracted");
});

runTest("engineering role prioritizes missing technical skills over generic professional skills", () => {
  const result = buildSkillPriorityRanking({
    missingCanonicalSkills: ["communication", "aws", "postgresql"],
    targetCanonicalSkills: ["python", "aws", "postgresql", "communication"],
    resumeCanonicalSkills: ["python"],
    resumeYears: 3,
    targetYoeMin: 3,
    targetYoeMax: 5,
    targetTitleCandidates: ["software engineer"],
    jobDescription: "Requirements: must have AWS and PostgreSQL. General: good communication.",
  });

  const rankings = result.ranking.map(r => r.skill);
  const awsIndex = rankings.indexOf("aws");
  const pgIndex = rankings.indexOf("postgresql");
  const commIndex = rankings.indexOf("communication");

  assert.ok(awsIndex < commIndex, "AWS (technical) should outrank communication (professional)");
  assert.ok(pgIndex < commIndex, "PostgreSQL (technical) should outrank communication (professional)");
});

runTest("qualitative explanations in buildJobExplanation do not contain raw percentages", () => {
  const explanation = buildJobExplanation({
    title: "Software Engineer",
    skillComparison: {
      matchedSkills: ["Python", "JavaScript"],
      missingSkills: ["AWS"],
      exactSkillCoverageScore: 80,
    },
    skillLevelFit: {
      score: 75,
      evidence: [],
    },
    semanticSimilarityScore: 65,
    experienceAlignment: { score: 90, explanation: "Matches experience" },
    roleCooccurrenceFit: { score: 85, explanation: "Good fit" },
    titleAlignment: { score: 100, explanation: "Matches title" },
    demandAlignment: { score: 90, explanation: "High demand" },
  });

  const percentRegex = /\b\d+%/;
  explanation.forEach(line => {
    assert.ok(!percentRegex.test(line), `Explanation line should not contain raw percentages: "${line}"`);
  });
});

if (failed) {
  process.exit(1);
}
