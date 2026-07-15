const STRONG_ACTION_VERBS = new Set([
  "achieved",
  "built",
  "created",
  "delivered",
  "designed",
  "developed",
  "drove",
  "engineered",
  "executed",
  "generated",
  "improved",
  "implemented",
  "increased",
  "launched",
  "led",
  "optimized",
  "reduced",
  "resolved",
  "scaled",
  "streamlined",
]);

const WEAK_PATTERNS = [
  /responsible for/i,
  /worked on/i,
  /involved in/i,
  /helped with/i,
  /various tasks/i,
  /etc\./i,
  /many tasks/i,
];

const QUANTIFIERS = [
  /\b\d+%/i,
  /\b\d+\+?\b/,
  /\$\s?\d+/i,
  /\b\d+\s*(users|clients|projects|teams|hours|days|weeks|months|years)\b/i,
  /\b(x|times)\b/i,
];

function splitStatements(text = "") {
  return String(text)
    .replace(/•/g, "\n")
    .split(/\n|•|- /)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);
}

function extractResumeStatements(extracted = {}) {
  const statements = [];
  const sources = [
    ...(Array.isArray(extracted.experience) ? extracted.experience : []),
    ...(Array.isArray(extracted.projects) ? extracted.projects : []),
  ];

  sources.forEach((item) => {
    if (typeof item === "string") {
      splitStatements(item).forEach((statement) => statements.push(statement));
      return;
    }

    if (item?.description) {
      splitStatements(item.description).forEach((statement) => statements.push(statement));
    }
    if (item?.summary) {
      splitStatements(item.summary).forEach((statement) => statements.push(statement));
    }
  });

  return [...new Set(statements)];
}

function scoreActionVerb(statement) {
  const firstWord = String(statement).trim().split(/\s+/)[0]?.toLowerCase();
  if (STRONG_ACTION_VERBS.has(firstWord)) {
    return {
      score: 100,
      note: "Starts with a strong action verb.",
    };
  }

  if ([...STRONG_ACTION_VERBS].some((verb) => new RegExp(`\\b${verb}\\b`, "i").test(statement))) {
    return {
      score: 70,
      note: "Contains an action verb but not in the strongest leading position.",
    };
  }

  return {
    score: 35,
    note: "Lead with a stronger action verb to improve impact.",
  };
}

function scoreMeasurableImpact(statement) {
  if (QUANTIFIERS.some((pattern) => pattern.test(statement))) {
    return {
      score: 100,
      note: "Includes measurable evidence such as numbers, scale, or percentage impact.",
    };
  }

  if (/\b(improved|optimized|reduced|increased|saved|grew)\b/i.test(statement)) {
    return {
      score: 65,
      note: "Describes impact but needs explicit measurable evidence.",
    };
  }

  return {
    score: 25,
    note: "Add metrics, percentages, counts, or scope to increase credibility.",
  };
}

function scoreClarity(statement) {
  const words = String(statement).trim().split(/\s+/).filter(Boolean);
  const vagueHits = WEAK_PATTERNS.filter((pattern) => pattern.test(statement)).length;

  let score = 75;
  if (words.length < 6) score -= 25;
  if (words.length > 30) score -= 20;
  score -= vagueHits * 15;

  if (/\b(using|with|via|through)\b/i.test(statement)) score += 10;

  return {
    score: Math.max(20, Math.min(100, score)),
    note:
      vagueHits > 0
        ? "Reduce vague wording and explain the specific task or outcome."
        : "Statement is reasonably clear and specific.",
  };
}

function buildSuggestion({ action, measurable, clarity }) {
  const suggestions = [];

  if (action.score < 60) suggestions.push("start with a stronger action verb");
  if (measurable.score < 60) suggestions.push("add measurable impact or scale");
  if (clarity.score < 60) suggestions.push("make the statement more specific");

  if (!suggestions.length) {
    return "Strong statement. Keep this phrasing style for the rest of the resume.";
  }

  return `Improve this statement by trying to ${suggestions.join(", ")}.`;
}

export function analyzeResumeQualityFromExtracted(extracted = {}) {
  const statements = extractResumeStatements(extracted);

  if (!statements.length) {
    return {
      overallScore: 40,
      confidenceLabel: "Low",
      statementCount: 0,
      categoryScores: {
        actionVerbScore: 40,
        measurableImpactScore: 35,
        clarityScore: 45,
      },
      summary:
        "The resume did not include enough descriptive statements for a reliable communication-quality assessment.",
      strengths: [],
      improvementAreas: [
        "Add detailed project and experience bullet points to unlock resume quality scoring.",
      ],
      statements: [],
    };
  }

  const scoredStatements = statements.map((statement) => {
    const action = scoreActionVerb(statement);
    const measurable = scoreMeasurableImpact(statement);
    const clarity = scoreClarity(statement);
    const overallScore = Math.round(
      action.score * 0.3 + measurable.score * 0.4 + clarity.score * 0.3
    );

    const flags = [];
    if (action.score < 60) flags.push("weak_action_verb");
    if (measurable.score < 60) flags.push("missing_metrics");
    if (clarity.score < 60) flags.push("clarity_issue");

    return {
      text: statement,
      actionVerbScore: action.score,
      measurableImpactScore: measurable.score,
      clarityScore: clarity.score,
      overallScore,
      flags,
      notes: [action.note, measurable.note, clarity.note],
      suggestion: buildSuggestion({ action, measurable, clarity }),
    };
  });

  const actionVerbScore = Math.round(
    scoredStatements.reduce((sum, statement) => sum + statement.actionVerbScore, 0) /
      scoredStatements.length
  );
  const measurableImpactScore = Math.round(
    scoredStatements.reduce((sum, statement) => sum + statement.measurableImpactScore, 0) /
      scoredStatements.length
  );
  const clarityScore = Math.round(
    scoredStatements.reduce((sum, statement) => sum + statement.clarityScore, 0) /
      scoredStatements.length
  );
  const overallScore = Math.round(
    actionVerbScore * 0.3 + measurableImpactScore * 0.4 + clarityScore * 0.3
  );

  const strengths = [];
  const improvementAreas = [];

  if (actionVerbScore >= 70) strengths.push("Uses action-oriented wording in most statements.");
  else improvementAreas.push("Lead more statements with strong action verbs.");

  if (measurableImpactScore >= 70) strengths.push("Frequently includes measurable or scoped achievements.");
  else improvementAreas.push("Add numbers, percentages, or scale to strengthen credibility.");

  if (clarityScore >= 70) strengths.push("Descriptions are clear and reasonably specific.");
  else improvementAreas.push("Rewrite vague statements with clearer task and outcome language.");

  let confidenceLabel = "Low";
  if (overallScore >= 75) confidenceLabel = "High";
  else if (overallScore >= 55) confidenceLabel = "Medium";

  return {
    overallScore,
    confidenceLabel,
    statementCount: scoredStatements.length,
    categoryScores: {
      actionVerbScore,
      measurableImpactScore,
      clarityScore,
    },
    summary:
      confidenceLabel === "High"
        ? "Resume statements communicate impact clearly and support a strong professional narrative."
        : confidenceLabel === "Medium"
        ? "Resume statements are usable but would benefit from stronger action wording and better quantification."
        : "Resume statements need stronger action, measurable impact, and clearer specificity to inspire confidence.",
    strengths,
    improvementAreas,
    statements: scoredStatements,
  };
}
