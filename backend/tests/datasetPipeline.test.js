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
  ]);

  assert.equal(dataset.cleaned.jobPostingCount, 2);
  assert.equal(dataset.validationSummary.quality.duplicateRowsRemoved, 1);
  assert.equal(dataset.validationSummary.quality.missingFieldRows, 1);
  assert.equal(dataset.validationSummary.quality.invalidYoeRows, 1);
  assert.equal(dataset.validationSummary.quality.retainedRowRate, 0.4);
  assert.equal(dataset.jobPostings[1].yoeLabel, "3-5");
  assert.deepEqual(dataset.jobPostings[1].skills, ["react", "javascript"]);
});
