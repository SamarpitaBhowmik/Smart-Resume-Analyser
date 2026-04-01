import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

import Job from "../models/jobs.js";
import SkillData from "../models/SkillsData.js";
import { normalizeSkills, normalizeTitle } from "./normaliseSkills.js";
import { parseYoeRange } from "./yoe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");
const RAW_DATASET_PATH = path.join(BACKEND_DIR, "data", "jobs.csv");
const PROCESSED_DIR = path.join(BACKEND_DIR, "data", "processed");
const JOB_POSTINGS_PATH = path.join(PROCESSED_DIR, "job_postings.json");
const SKILL_FACTS_PATH = path.join(PROCESSED_DIR, "skill_facts.json");
const VALIDATION_SUMMARY_PATH = path.join(PROCESSED_DIR, "validation-summary.json");

const CURATED_COMPANY = "Curated Market Benchmark";
const CURATED_LOCATION = "India / Remote";
const CURATED_SOURCE = "Curated internal job-role benchmark";

let cachedPreparedDataset = null;

function ensureProcessedDir() {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

function readCsvRows() {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(RAW_DATASET_PATH)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function buildDatasetVersion() {
  const stats = fs.statSync(RAW_DATASET_PATH);
  return `jobs-csv-${stats.mtime.toISOString().slice(0, 10)}`;
}

function titleCase(text = "") {
  return String(text)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildDescription(title, yoeLabel, skills) {
  const keySkills = skills.slice(0, 8).join(", ");
  return [
    `${title} benchmark profile for ${yoeLabel} years of experience.`,
    keySkills
      ? `Typical market requirements include ${keySkills}.`
      : "Typical market requirements focus on domain-relevant technical and functional skills.",
    "This curated role profile is used for research-grade recommendation, skill-gap detection, and market analytics.",
  ].join(" ");
}

function summarizeTopEntries(entries) {
  return entries
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function transformRows(rawRows) {
  const datasetVersion = buildDatasetVersion();
  const seenJobKeys = new Set();
  const droppedRows = [];
  const cleanedJobs = [];
  const skillFacts = [];
  const titleCounts = new Map();
  const skillCounts = new Map();
  const yoeCounts = new Map();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const title = String(row.Title || "").trim();
    const rawYoe = String(row.YOE || "").trim();
    const rawSkills = String(row.Skills || "").trim();

    if (!title || !rawYoe || !rawSkills) {
      droppedRows.push({
        rowNumber,
        reason: "missing_required_field",
        title: title || null,
        yoe: rawYoe || null,
      });
      return;
    }

    const yoeRange = parseYoeRange(rawYoe);
    if (!yoeRange.valid) {
      droppedRows.push({
        rowNumber,
        reason: yoeRange.reason,
        title,
        yoe: rawYoe,
      });
      return;
    }

    const parsedSkills = normalizeSkills(rawSkills);
    if (!parsedSkills.length) {
      droppedRows.push({
        rowNumber,
        reason: "no_valid_skills_after_cleaning",
        title,
        yoe: rawYoe,
      });
      return;
    }

    const normalizedTitle = normalizeTitle(title);
    const dedupeKey = `${normalizedTitle}|${yoeRange.label}|${parsedSkills.join("|")}`;
    if (seenJobKeys.has(dedupeKey)) {
      droppedRows.push({
        rowNumber,
        reason: "duplicate_row",
        title,
        yoe: rawYoe,
      });
      return;
    }
    seenJobKeys.add(dedupeKey);

    const jobId = `JOB-${String(cleanedJobs.length + 1).padStart(4, "0")}`;
    const displayTitle = titleCase(title);
    const postedAt = new Date(`${datasetVersion.slice(-10)}T00:00:00.000Z`);

    const job = {
      jobId,
      title: displayTitle,
      normalizedTitle,
      company: CURATED_COMPANY,
      location: CURATED_LOCATION,
      description: buildDescription(displayTitle, yoeRange.label, parsedSkills),
      experienceText: rawYoe,
      yoeMin: yoeRange.min,
      yoeMax: yoeRange.max,
      yoeMid: yoeRange.mid,
      yoeLabel: yoeRange.label,
      rawSkills,
      skills: parsedSkills,
      source: CURATED_SOURCE,
      sourceType: "role-benchmark",
      datasetVersion,
      postedAt,
    };

    cleanedJobs.push(job);
    titleCounts.set(displayTitle, (titleCounts.get(displayTitle) || 0) + 1);
    yoeCounts.set(yoeRange.label, (yoeCounts.get(yoeRange.label) || 0) + 1);

    parsedSkills.forEach((skill) => {
      skillFacts.push({
        jobId,
        title: displayTitle,
        normalizedTitle,
        skill,
        yoeMin: yoeRange.min,
        yoeMax: yoeRange.max,
        yoeMid: yoeRange.mid,
        yoeLabel: yoeRange.label,
        source: CURATED_SOURCE,
        datasetVersion,
      });
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    });
  });

  const invalidYoeRows = droppedRows.filter((row) => row.reason === "invalid_yoe").length;
  const duplicateRows = droppedRows.filter((row) => row.reason === "duplicate_row").length;
  const missingFieldRows = droppedRows.filter((row) => row.reason === "missing_required_field").length;

  return {
    metadata: {
      datasetVersion,
      generatedAt: new Date().toISOString(),
      sourceFile: path.relative(BACKEND_DIR, RAW_DATASET_PATH).replace(/\\/g, "/"),
      sourceRows: rawRows.length,
    },
    jobPostings: cleanedJobs,
    skillFacts,
    validationSummary: {
      datasetVersion,
      generatedAt: new Date().toISOString(),
      sourceFile: path.relative(BACKEND_DIR, RAW_DATASET_PATH).replace(/\\/g, "/"),
      raw: {
        rowCount: rawRows.length,
      },
      cleaned: {
        jobPostingCount: cleanedJobs.length,
        skillFactCount: skillFacts.length,
        uniqueTitles: titleCounts.size,
        uniqueSkills: skillCounts.size,
      },
      quality: {
        retainedRowRate: rawRows.length ? Number((cleanedJobs.length / rawRows.length).toFixed(4)) : 0,
        droppedRowCount: droppedRows.length,
        duplicateRowsRemoved: duplicateRows,
        invalidYoeRows,
        missingFieldRows,
        topNormalizedTitles: summarizeTopEntries(
          Array.from(titleCounts.entries()).map(([title, count]) => ({ title, count }))
        ),
        topNormalizedSkills: summarizeTopEntries(
          Array.from(skillCounts.entries()).map(([skill, count]) => ({ skill, count }))
        ),
        yoeDistribution: summarizeTopEntries(
          Array.from(yoeCounts.entries()).map(([label, count]) => ({ yoeLabel: label, count }))
        ),
        droppedReasons: summarizeTopEntries(
          Array.from(
            droppedRows.reduce((map, row) => {
              map.set(row.reason, (map.get(row.reason) || 0) + 1);
              return map;
            }, new Map()).entries()
          ).map(([reason, count]) => ({ reason, count }))
        ),
        sampleDroppedRows: droppedRows.slice(0, 15),
      },
    },
  };
}

function writeProcessedArtifacts(preparedDataset) {
  ensureProcessedDir();
  fs.writeFileSync(JOB_POSTINGS_PATH, JSON.stringify(preparedDataset.jobPostings, null, 2));
  fs.writeFileSync(SKILL_FACTS_PATH, JSON.stringify(preparedDataset.skillFacts, null, 2));
  fs.writeFileSync(VALIDATION_SUMMARY_PATH, JSON.stringify(preparedDataset.validationSummary, null, 2));
}

export async function prepareResearchDataset({ force = false } = {}) {
  if (cachedPreparedDataset && !force) {
    return cachedPreparedDataset;
  }

  const rawRows = await readCsvRows();
  const preparedDataset = transformRows(rawRows);
  writeProcessedArtifacts(preparedDataset);
  cachedPreparedDataset = preparedDataset;
  return preparedDataset;
}

export function readValidationSummaryFromDisk() {
  if (!fs.existsSync(VALIDATION_SUMMARY_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(VALIDATION_SUMMARY_PATH, "utf8"));
}

export async function getValidationSummary() {
  const onDisk = readValidationSummaryFromDisk();
  if (onDisk) return onDisk;
  const preparedDataset = await prepareResearchDataset();
  return preparedDataset.validationSummary;
}

export async function ensureResearchDatasetsReady({ forceRefresh = false } = {}) {
  const preparedDataset = await prepareResearchDataset({ force: forceRefresh });
  const jobCount = await Job.countDocuments();
  const skillCount = await SkillData.countDocuments();

  if (forceRefresh || jobCount === 0 || skillCount === 0) {
    await Job.deleteMany({});
    await SkillData.deleteMany({});
    if (preparedDataset.jobPostings.length) {
      await Job.insertMany(preparedDataset.jobPostings, { ordered: false });
    }
    if (preparedDataset.skillFacts.length) {
      await SkillData.insertMany(preparedDataset.skillFacts, { ordered: false });
    }
  }

  return preparedDataset.validationSummary;
}

export function getProcessedPaths() {
  return {
    rawDatasetPath: RAW_DATASET_PATH,
    processedDir: PROCESSED_DIR,
    jobPostingsPath: JOB_POSTINGS_PATH,
    skillFactsPath: SKILL_FACTS_PATH,
    validationSummaryPath: VALIDATION_SUMMARY_PATH,
  };
}
