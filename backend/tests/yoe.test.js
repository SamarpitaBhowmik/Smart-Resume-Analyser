import test from "node:test";
import assert from "node:assert/strict";

import { parseYoeRange } from "../utils/yoe.js";

test("parseYoeRange handles standard numeric ranges", () => {
  const parsed = parseYoeRange("2-4 years");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.min, 2);
  assert.equal(parsed.max, 4);
  assert.equal(parsed.label, "2-4");
});

test("parseYoeRange handles plus-style requirements", () => {
  const parsed = parseYoeRange("5+ years");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.min, 5);
  assert.equal(parsed.max, null);
  assert.equal(parsed.label, "5+");
});

test("parseYoeRange normalizes month-like spreadsheet artifacts", () => {
  const parsed = parseYoeRange("03-May");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.min, 3);
  assert.equal(parsed.max, 5);
  assert.equal(parsed.label, "3-5");
});

test("parseYoeRange rejects invalid values", () => {
  const parsed = parseYoeRange("experienced candidate");
  assert.equal(parsed.valid, false);
  assert.equal(parsed.reason, "invalid_yoe");
});
