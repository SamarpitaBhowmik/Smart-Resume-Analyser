import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHybridScore,
  buildSkillComparison,
  computeExperienceAlignment,
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
