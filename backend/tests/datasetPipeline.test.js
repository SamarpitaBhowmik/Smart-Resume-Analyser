import test from "node:test";
import assert from "node:assert/strict";

import { transformRows } from "../utils/datasetPipeline.js";

test("transformRows drops missing fields, invalid YOE values, and duplicates", () => {
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
      "Short Intro": "Duplicate row",
      Skills: "SQL, Tableau",
      "Course Type": "Guided Project",
      Level: "Beginner",
      Duration: "Approximately 2 weeks to complete",
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

  assert.equal(dataset.validationSummary.cleaned.jobPostingCount, 2);
  assert.equal(dataset.validationSummary.cleaned.courseCatalogCount >= 1, true);
  assert.equal(dataset.validationSummary.quality.duplicateRowsRemoved, 1);
  assert.equal(dataset.validationSummary.quality.missingFieldRows, 1);
  assert.equal(dataset.validationSummary.quality.invalidYoeRows, 1);
  assert.equal(dataset.validationSummary.quality.retainedRowRate, 0.4);
  assert.equal(dataset.validationSummary.datasets.courses.cleaned.rawCourseCount, 2);
  assert.equal(dataset.validationSummary.datasets.courses.quality.duplicateRowsRemoved, 1);
  assert.equal(dataset.validationSummary.datasets.courses.quality.missingTitleRows, 1);
  assert.equal(dataset.validationSummary.datasets.courses.quality.inferredSkillRows, 1);
  assert.ok(dataset.validationSummary.consistency.sharedSkillCount >= 1);
  assert.equal(dataset.jobPostings[1].yoeLabel, "3-5");
  assert.deepEqual(dataset.jobPostings[1].skills, ["react", "javascript"]);
  assert.equal(dataset.courseCatalog[0].format, "project");
  assert.deepEqual(dataset.courseCatalog[0].skills_covered.slice(0, 2), ["sql", "tableau"]);
});
