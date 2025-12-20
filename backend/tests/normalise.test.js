import { normalizeSkills } from "../utils/normaliseSkills.js";

const input =
  "Python basics; JavaScript basics; Intro to NLP; Hugging Face basics; SpaCy basics";

const output = normalizeSkills(input);

console.log("INPUT:", input);
console.log("OUTPUT:", output);
