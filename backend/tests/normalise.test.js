import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSkill, normalizeSkills, normalizeTitle } from "../utils/normaliseSkills.js";

test("normalizeSkill collapses aliases to canonical skill names", () => {
  assert.equal(normalizeSkill("JS"), "javascript");
  assert.equal(normalizeSkill("ReactJS"), "react");
  assert.equal(normalizeSkill("Node"), "node.js");
});

test("normalizeSkills removes introductory noise and duplicates", () => {
  const result = normalizeSkills(
    "Python basics; JavaScript basics; Intro to NLP; Hugging Face basics; JS"
  );

  assert.deepEqual(result, ["python", "javascript", "nlp", "hugging face"]);
});

test("normalizeTitle removes generic role suffixes for dedupe-friendly titles", () => {
  assert.equal(normalizeTitle("Senior Data Scientist Engineer"), "senior data scientist");
  assert.equal(normalizeTitle("Frontend Developer"), "frontend");
});
