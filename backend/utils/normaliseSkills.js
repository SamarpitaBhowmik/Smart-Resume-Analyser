// utils/normalizeSkills.js

// words to remove (noise)
const REMOVE_WORDS = [
  "basics",
  "basic",
  "fundamentals",
  "intro",
  "to",
  "introduction",
  "exposure",
  "awareness"
];

// skill name mapping (standardization)
const SKILL_MAP = {
  "js": "javascript",
  "node": "node.js",
  "reactjs": "react",
  "react.js": "react",
   "nlp": "nlp",
  "natural language processing": "nlp",
  "intro nlp": "nlp",
  "to nlp": "nlp",
  "asp.net core": "asp.net core",
  "asp.net mvc": "asp.net mvc",
  "sql": "sql",
  "sql server": "sql server",
  "postgres": "postgresql",
  "mongo": "mongodb",
  "hugging face": "hugging face",
  "hf": "hugging face",
  "ci cd": "ci/cd",
  "ci/cd": "ci/cd",
  "k8s": "kubernetes"
};

// main function
export function normalizeSkills(skillsString) {
  if (!skillsString) return [];

  return [
    ...new Set(
      skillsString
        .split(";") // split skills
        .map(skill =>
          skill
            .toLowerCase()
            .replace(/[()]/g, "")
            .replace(/\s+/g, " ")
            .trim()
        )
        .map(skill => {
          REMOVE_WORDS.forEach(word => {
            skill = skill.replace(new RegExp(`\\b${word}\\b`, "g"), "");
          });
          return skill.trim();
        })
        .map(skill => SKILL_MAP[skill] || skill)
        .filter(skill => skill.length > 1)
    )
  ];
}
