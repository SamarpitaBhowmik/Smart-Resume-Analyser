import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHybridScore,
  buildRecommendationConfidence,
  buildSkillComparison,
  computeDemandAlignment,
  computeExperienceAlignment,
  computeTitleAlignment,
} from "../utils/jobMatching.js";

test("buildSkillComparison rewards canonical skill matches and exposes alias alignment", () => {
  const result = buildSkillComparison(
    ["JS", "Nodejs", "ReactJS"],
    ["JavaScript", "Node", "React", "SQL"]
  );

  assert.equal(result.skillCoverageScore, 75);
  assert.deepEqual(result.missingSkills, ["SQL"]);
  assert.equal(result.semanticMatches.length, 3);
});

test("computeExperienceAlignment returns full score inside the required range", () => {
  const result = computeExperienceAlignment(3, 2, 4);
  assert.equal(result.score, 100);
});

test("buildHybridScore uses the weighted research formula", () => {
  const score = buildHybridScore({
    skillCoverageScore: 80,
    semanticSimilarityScore: 70,
    experienceAlignmentScore: 60,
  });

  assert.equal(score, 74);
});

test("computeTitleAlignment rewards target role family overlap", () => {
  const result = computeTitleAlignment({
    targetTitleCandidates: ["data analyst", "business intelligence analyst"],
    jobTitle: "Data Analyst",
    jobNormalizedTitle: "data analyst",
  });

  assert.ok(result.score >= 75);
});

test("computeDemandAlignment favors roles where matched demand exceeds missing demand pressure", () => {
  const result = computeDemandAlignment({
    matchedCanonical: ["python", "sql"],
    missingCanonical: ["tableau"],
  });

  assert.ok(result.score > 40);
  assert.match(result.explanation, /Matched skills carry an average benchmark demand score/i);
});

test("buildRecommendationConfidence summarizes recommendation evidence", () => {
  const result = buildRecommendationConfidence({
    exactSkillCoverageScore: 82,
    skillLevelFitScore: 76,
    experienceAlignmentScore: 88,
    titleAlignmentScore: 91,
  });

  assert.ok(result.score >= 80);
  assert.equal(result.label, "High confidence");
});
