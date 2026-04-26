import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

import Job from "../models/jobs.js";
import SkillData from "../models/SkillsData.js";
import { normalizeSkill, normalizeSkills, normalizeTitle } from "./normaliseSkills.js";
import { parseYoeRange } from "./yoe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");
const RAW_JOBS_DATASET_PATH = path.join(BACKEND_DIR, "data", "jobs.csv");
const RAW_COURSES_DATASET_PATH = path.join(BACKEND_DIR, "data", "Online_Courses.csv");
const LEGACY_COURSE_CATALOG_PATH = path.join(BACKEND_DIR, "data", "courseCatalog.json");
const PROCESSED_DIR = path.join(BACKEND_DIR, "data", "processed");
const JOB_POSTINGS_PATH = path.join(PROCESSED_DIR, "job_postings.json");
const SKILL_FACTS_PATH = path.join(PROCESSED_DIR, "skill_facts.json");
const COURSE_CATALOG_PATH = path.join(PROCESSED_DIR, "course_catalog.json");
const VALIDATION_SUMMARY_PATH = path.join(PROCESSED_DIR, "validation-summary.json");

const CURATED_COMPANY = "Curated Market Benchmark";
const CURATED_LOCATION = "India / Remote";
const CURATED_SOURCE = "Curated internal job-role benchmark";

const SITE_TRUST_SCORES = {
  coursera: 89,
  udemy: 72,
  edx: 90,
  udacity: 84,
  pluralsight: 82,
  datacamp: 83,
  linkedin: 80,
  microsoft: 94,
  google: 93,
};

let cachedPreparedDataset = null;

function ensureProcessedDir() {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildDatasetVersion() {
  const sourcePaths = [RAW_JOBS_DATASET_PATH, RAW_COURSES_DATASET_PATH].filter((filePath) => fs.existsSync(filePath));
  const latestMtime = sourcePaths
    .map((filePath) => fs.statSync(filePath).mtime)
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return `research-dataset-${latestMtime.toISOString().slice(0, 10)}`;
}

function titleCase(text = "") {
  return String(text)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
  return entries.sort((a, b) => b.count - a.count).slice(0, 10);
}

function buildReasonCounts(rows = []) {
  return summarizeTopEntries(
    Array.from(
      rows.reduce((map, row) => {
        map.set(row.reason, (map.get(row.reason) || 0) + 1);
        return map;
      }, new Map()).entries()
    ).map(([reason, count]) => ({ reason, count }))
  );
}

function parseInteger(value) {
  if (value == null || value === "") return null;
  const numeric = String(value).replace(/[^\d.]/g, "");
  if (!numeric) return null;
  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFloatValue(value) {
  if (value == null || value === "") return null;
  const numeric = String(value).replace(/[^\d.]/g, "");
  if (!numeric) return null;
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCourseLevel(...values) {
  const combined = values.filter(Boolean).join(" ").toLowerCase();
  if (/(advanced|expert|senior)/i.test(combined)) return "advanced";
  if (/(intermediate|professional|specialization)/i.test(combined)) return "intermediate";
  if (/(beginner|intro|foundation|fundamental)/i.test(combined)) return "beginner";
  return "intermediate";
}

function isLikelyValidUrl(value = "") {
  try {
    const parsed = new URL(String(value));
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function hasSuspiciousEncoding(value = "") {
  return /â|Ã|�/.test(String(value));
}

function inferSkillsFromCourseMetadata(row = {}) {
  const metadataFields = [
    row.Category,
    row["Sub-Category"],
    row.Title,
    row["Course Title"],
    row["Short Intro"],
    row["Course Short Intro"],
    row["What you learn"],
    row.Topics,
    row["COURSE CATEGORIES"],
  ]
    .filter(Boolean)
    .join("; ");

  const inferred = normalizeSkills(metadataFields);
  return inferred.slice(0, 12);
}

function normalizeCourseFormat(courseType = "", title = "", intro = "") {
  const combined = `${courseType} ${title} ${intro}`.toLowerCase();
  if (/(guided project|capstone|project|hands-on)/i.test(combined)) return "project";
  if (/(video|tutorial|lecture)/i.test(combined)) return "video";
  if (/(documentation|docs)/i.test(combined)) return "docs";
  return "course";
}

function parseDuration(duration = "") {
  const text = String(duration).toLowerCase().trim();
  if (!text) {
    return {
      estimated_hours: 18,
      estimated_weeks: 3,
    };
  }

  const monthMatch = text.match(/(\d+(?:\.\d+)?)\s*month/);
  if (monthMatch) {
    const months = Number.parseFloat(monthMatch[1]);
    const weeks = Math.max(1, Math.round(months * 4));
    return {
      estimated_hours: weeks * 6,
      estimated_weeks: weeks,
    };
  }

  const weekMatch = text.match(/(\d+(?:\.\d+)?)\s*week/);
  if (weekMatch) {
    const weeks = Math.max(1, Math.round(Number.parseFloat(weekMatch[1])));
    return {
      estimated_hours: weeks * 6,
      estimated_weeks: weeks,
    };
  }

  const dayMatch = text.match(/(\d+(?:\.\d+)?)\s*day/);
  if (dayMatch) {
    const days = Math.max(1, Math.round(Number.parseFloat(dayMatch[1])));
    const weeks = Math.max(1, Math.round(days / 5));
    return {
      estimated_hours: days * 2,
      estimated_weeks: weeks,
    };
  }

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*hour/);
  if (hourMatch) {
    const hours = Math.max(1, Math.round(Number.parseFloat(hourMatch[1])));
    return {
      estimated_hours: hours,
      estimated_weeks: Math.max(1, Math.round(hours / 6)),
    };
  }

  return {
    estimated_hours: 18,
    estimated_weeks: 3,
  };
}

function normalizeCostType(row = {}, site = "") {
  const priceSignals = [
    row.Price,
    row["Monthly access"],
    row["6-Month access"],
    row["5-Month access"],
    row["4-Month access"],
    row["3-Month access"],
    row["2-Month access"],
    row["Premium course"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/free/.test(priceSignals)) return "free";
  if (priceSignals.trim()) return "paid";
  if (/(microsoft|google|docs|documentation)/i.test(site)) return "free";
  return "mixed";
}

function deriveProviderTrustScore(site = "") {
  const normalizedSite = String(site).toLowerCase();
  for (const [key, score] of Object.entries(SITE_TRUST_SCORES)) {
    if (normalizedSite.includes(key)) return score;
  }
  return 78;
}

function deriveHandsOnScore({ format, courseType = "", uniqueProjects = 0, whatYouLearn = "" }) {
  let score = 58;
  if (format === "project") score += 25;
  if (/(guided project|capstone|lab|hands-on)/i.test(courseType)) score += 12;
  if (uniqueProjects > 0) score += Math.min(10, uniqueProjects * 2);
  if (/(build|implement|practice|portfolio|project)/i.test(whatYouLearn)) score += 8;
  return Math.min(score, 95);
}

function getCourseTitle(row = {}) {
  return String(row.Title || row["Course Title"] || "").trim();
}

function getCourseUrl(row = {}) {
  return String(row.URL || row["Course URL"] || "").trim();
}

function getCourseIntro(row = {}) {
  return String(row["Short Intro"] || row["Course Short Intro"] || "").trim();
}

function getCourseSkills(row = {}) {
  const directSkills = normalizeSkills(row.Skills || "");
  if (directSkills.length) return directSkills;
  return inferSkillsFromCourseMetadata(row);
}

function getCoursePrerequisites(row = {}) {
  return normalizeSkills(row.Prequisites || row.Prerequisites || "");
}

function mergeCourseCatalog(processedCourses = []) {
  const legacyCourses = readJsonArray(LEGACY_COURSE_CATALOG_PATH);
  const merged = new Map();

  processedCourses.forEach((course) => {
    merged.set(course.course_id, course);
  });

  legacyCourses.forEach((course, index) => {
    const normalizedCourse = {
      ...course,
      course_id: course.course_id || `legacy-course-${index + 1}`,
      skills_covered: normalizeSkills(course.skills_covered || []),
      prerequisites: normalizeSkills(course.prerequisites || []),
      level: normalizeCourseLevel(course.level),
      format: normalizeCourseFormat(course.format, course.title, ""),
      cost_type: course.cost_type || "free",
      provider_trust_score: Number.isFinite(course.provider_trust_score) ? course.provider_trust_score : 85,
      hands_on_score: Number.isFinite(course.hands_on_score) ? course.hands_on_score : 70,
      source_type: course.source_type || "legacy_course_catalog",
      source_dataset: course.source_dataset || "legacy_course_catalog",
    };

    if (!merged.has(normalizedCourse.course_id)) {
      merged.set(normalizedCourse.course_id, normalizedCourse);
    }
  });

  return Array.from(merged.values());
}

function transformJobs(rawRows, datasetVersion) {
  const seenJobKeys = new Set();
  const droppedRows = [];
  const cleanedJobs = [];
  const skillFacts = [];
  const titleCounts = new Map();
  const skillCounts = new Map();
  const yoeCounts = new Map();
  const suspiciousRows = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const title = String(row.Title || "").trim();
    const rawYoe = String(row.YOE || "").trim();
    const rawSkills = String(row.Skills || "").trim();
    const suspiciousSignals = [];

    if (hasSuspiciousEncoding(title)) suspiciousSignals.push("title_encoding");
    if (hasSuspiciousEncoding(rawYoe)) suspiciousSignals.push("yoe_encoding");
    if (hasSuspiciousEncoding(rawSkills)) suspiciousSignals.push("skills_encoding");

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

    if (suspiciousSignals.length) {
      suspiciousRows.push({
        rowNumber,
        title,
        yoe: rawYoe,
        signals: suspiciousSignals,
      });
    }
  });

  const invalidYoeRows = droppedRows.filter((row) => row.reason === "invalid_yoe").length;
  const duplicateRows = droppedRows.filter((row) => row.reason === "duplicate_row").length;
  const missingFieldRows = droppedRows.filter((row) => row.reason === "missing_required_field").length;

  return {
    jobPostings: cleanedJobs,
    skillFacts,
    validation: {
      sourceFile: path.relative(BACKEND_DIR, RAW_JOBS_DATASET_PATH).replace(/\\/g, "/"),
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
        averageSkillsPerJob: cleanedJobs.length
          ? Number((skillFacts.length / cleanedJobs.length).toFixed(2))
          : 0,
        jobsWithLowSkillCount: cleanedJobs.filter((job) => (job.skills || []).length < 3).length,
        suspiciousEncodingRows: suspiciousRows.length,
        topNormalizedTitles: summarizeTopEntries(
          Array.from(titleCounts.entries()).map(([title, count]) => ({ title, count }))
        ),
        topNormalizedSkills: summarizeTopEntries(
          Array.from(skillCounts.entries()).map(([skill, count]) => ({ skill, count }))
        ),
        yoeDistribution: summarizeTopEntries(
          Array.from(yoeCounts.entries()).map(([label, count]) => ({ yoeLabel: label, count }))
        ),
        droppedReasons: buildReasonCounts(droppedRows),
        suspiciousSignals: buildReasonCounts(
          suspiciousRows.flatMap((row) => row.signals.map((signal) => ({ reason: signal })))
        ),
        sampleDroppedRows: droppedRows.slice(0, 15),
        sampleSuspiciousRows: suspiciousRows.slice(0, 15),
      },
    },
  };
}

function transformCourses(rawRows, datasetVersion) {
  const seenCourseKeys = new Set();
  const cleanedCourses = [];
  const droppedRows = [];
  const providerCounts = new Map();
  const formatCounts = new Map();
  const levelCounts = new Map();
  const skillCounts = new Map();
  const suspiciousRows = [];
  let inferredSkillRows = 0;
  let invalidUrlRows = 0;
  let missingProviderRows = 0;
  let suspiciousRatingRows = 0;
  let suspiciousDurationRows = 0;

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const title = getCourseTitle(row);
    const url = getCourseUrl(row);
    const intro = getCourseIntro(row);
    const site = String(row.Site || row.School || row["Created by"] || "Unknown provider").trim();
    const courseType = String(row["Course Type"] || row.Program || row["Program Type"] || "").trim();
    const level = normalizeCourseLevel(row.Level, courseType, title);
    const format = normalizeCourseFormat(courseType, title, intro);
    const directSkills = normalizeSkills(row.Skills || "");
    const skills = directSkills.length ? directSkills : inferSkillsFromCourseMetadata(row);
    const prerequisites = getCoursePrerequisites(row);
    const suspiciousSignals = [];

    if (!title || !url || !skills.length) {
      droppedRows.push({
        rowNumber,
        reason: !title ? "missing_title" : !url ? "missing_url" : "missing_skills",
        title: title || null,
      });
      return;
    }

    if (!isLikelyValidUrl(url)) {
      droppedRows.push({
        rowNumber,
        reason: "invalid_url",
        title,
      });
      invalidUrlRows += 1;
      return;
    }

    const dedupeKey = `${slugify(title)}|${url.toLowerCase()}`;
    if (seenCourseKeys.has(dedupeKey)) {
      droppedRows.push({
        rowNumber,
        reason: "duplicate_row",
        title,
      });
      return;
    }
    seenCourseKeys.add(dedupeKey);

    const duration = parseDuration(row.Duration || row["Weekly study"] || "");
    const reviews = parseInteger(row["Number of Reviews"] || row["Number of ratings"]);
    const viewers = parseInteger(row["Number of viewers"]);
    const uniqueProjects = parseInteger(row["Unique Projects"]) || 0;
    const rating = parseFloatValue(row.Rating);
    const provider = site || "Unknown provider";
    const normalizedProvider = slugify(provider) || "unknown-provider";
    const primarySkill = normalizeSkill(skills[0] || "general");
    const courseId = `course-${slugify(title)}-${normalizedProvider}-${String(index + 1).padStart(4, "0")}`;
    const providerTrustScore = deriveProviderTrustScore(provider);
    const handsOnScore = deriveHandsOnScore({
      format,
      courseType,
      uniqueProjects,
      whatYouLearn: row["What you learn"] || "",
    });

    if (!directSkills.length) inferredSkillRows += 1;
    if (!site || provider === "Unknown provider") missingProviderRows += 1;
    if (rating != null && (rating < 0 || rating > 5)) {
      suspiciousRatingRows += 1;
      suspiciousSignals.push("rating_out_of_range");
    }
    if (duration.estimated_weeks > 52) {
      suspiciousDurationRows += 1;
      suspiciousSignals.push("duration_outlier");
    }
    if (hasSuspiciousEncoding(title) || hasSuspiciousEncoding(intro)) {
      suspiciousSignals.push("text_encoding");
    }

    const normalizedCourse = {
      course_id: courseId,
      title,
      provider,
      url,
      short_intro: intro,
      skills_covered: skills,
      level,
      estimated_hours: duration.estimated_hours,
      estimated_weeks: duration.estimated_weeks,
      format,
      provider_trust_score: providerTrustScore,
      hands_on_score: handsOnScore,
      cost_type: normalizeCostType(row, provider),
      prerequisites,
      last_reviewed: datasetVersion.slice(-10),
      source_type: "online_courses_csv",
      source_dataset: "Online_Courses.csv",
      category: String(row.Category || "").trim() || null,
      sub_category: String(row["Sub-Category"] || "").trim() || null,
      language: String(row.Language || "").trim() || null,
      course_type: courseType || null,
      primary_skill: primarySkill || null,
      rating,
      review_count: reviews,
      viewer_count: viewers,
      rank: parseInteger(row.Rank),
    };

    cleanedCourses.push(normalizedCourse);
    providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
    formatCounts.set(format, (formatCounts.get(format) || 0) + 1);
    levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    skills.forEach((skill) => {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    });

    if (suspiciousSignals.length) {
      suspiciousRows.push({
        rowNumber,
        title,
        signals: suspiciousSignals,
      });
    }
  });

  const mergedCatalog = mergeCourseCatalog(cleanedCourses);

  return {
    courseCatalog: mergedCatalog,
    validation: {
      sourceFile: path.relative(BACKEND_DIR, RAW_COURSES_DATASET_PATH).replace(/\\/g, "/"),
      raw: {
        rowCount: rawRows.length,
      },
      cleaned: {
        rawCourseCount: cleanedCourses.length,
        mergedCatalogCount: mergedCatalog.length,
        uniqueProviders: providerCounts.size,
        uniqueSkills: skillCounts.size,
      },
      quality: {
        retainedRowRate: rawRows.length ? Number((cleanedCourses.length / rawRows.length).toFixed(4)) : 0,
        droppedRowCount: droppedRows.length,
        duplicateRowsRemoved: droppedRows.filter((row) => row.reason === "duplicate_row").length,
        missingTitleRows: droppedRows.filter((row) => row.reason === "missing_title").length,
        missingUrlRows: droppedRows.filter((row) => row.reason === "missing_url").length,
        missingSkillsRows: droppedRows.filter((row) => row.reason === "missing_skills").length,
        invalidUrlRows,
        inferredSkillRows,
        missingProviderRows,
        suspiciousRatingRows,
        suspiciousDurationRows,
        averageSkillsPerCourse: cleanedCourses.length
          ? Number((Array.from(skillCounts.values()).reduce((sum, count) => sum + count, 0) / cleanedCourses.length).toFixed(2))
          : 0,
        coursesWithSingleSkill: cleanedCourses.filter((course) => (course.skills_covered || []).length === 1).length,
        suspiciousRows: suspiciousRows.length,
        topProviders: summarizeTopEntries(
          Array.from(providerCounts.entries()).map(([provider, count]) => ({ provider, count }))
        ),
        topFormats: summarizeTopEntries(
          Array.from(formatCounts.entries()).map(([format, count]) => ({ format, count }))
        ),
        levelDistribution: summarizeTopEntries(
          Array.from(levelCounts.entries()).map(([level, count]) => ({ level, count }))
        ),
        topNormalizedSkills: summarizeTopEntries(
          Array.from(skillCounts.entries()).map(([skill, count]) => ({ skill, count }))
        ),
        droppedReasons: buildReasonCounts(droppedRows),
        suspiciousSignals: buildReasonCounts(
          suspiciousRows.flatMap((row) => row.signals.map((signal) => ({ reason: signal })))
        ),
        sampleDroppedRows: droppedRows.slice(0, 15),
        sampleSuspiciousRows: suspiciousRows.slice(0, 15),
      },
    },
  };
}

export function transformRows(rawJobRows = [], rawCourseRows = []) {
  const datasetVersion = buildDatasetVersion();
  const jobs = transformJobs(rawJobRows, datasetVersion);
  const courses = transformCourses(rawCourseRows, datasetVersion);
  const jobSkillSet = new Set(jobs.jobPostings.flatMap((job) => job.skills || []));
  const courseSkillSet = new Set(courses.courseCatalog.flatMap((course) => course.skills_covered || []));
  const sharedSkills = [...jobSkillSet].filter((skill) => courseSkillSet.has(skill));
  const jobSkillCoverageRate = jobSkillSet.size ? Number((sharedSkills.length / jobSkillSet.size).toFixed(4)) : 0;

  return {
    metadata: {
      datasetVersion,
      generatedAt: new Date().toISOString(),
      sourceFiles: [
        path.relative(BACKEND_DIR, RAW_JOBS_DATASET_PATH).replace(/\\/g, "/"),
        path.relative(BACKEND_DIR, RAW_COURSES_DATASET_PATH).replace(/\\/g, "/"),
      ],
    },
    jobPostings: jobs.jobPostings,
    skillFacts: jobs.skillFacts,
    courseCatalog: courses.courseCatalog,
    validationSummary: {
      datasetVersion,
      generatedAt: new Date().toISOString(),
      sourceFiles: {
        jobs: jobs.validation.sourceFile,
        courses: courses.validation.sourceFile,
      },
      raw: {
        rowCount: rawJobRows.length,
        jobRowCount: rawJobRows.length,
        courseRowCount: rawCourseRows.length,
      },
      cleaned: {
        jobPostingCount: jobs.validation.cleaned.jobPostingCount,
        skillFactCount: jobs.validation.cleaned.skillFactCount,
        uniqueTitles: jobs.validation.cleaned.uniqueTitles,
        uniqueSkills: jobs.validation.cleaned.uniqueSkills,
        courseCatalogCount: courses.courseCatalog.length,
        rawCourseCount: courses.validation.cleaned.rawCourseCount,
        mergedCourseCatalogCount: courses.validation.cleaned.mergedCatalogCount,
        uniqueCourseProviders: courses.validation.cleaned.uniqueProviders,
        uniqueCourseSkills: courses.validation.cleaned.uniqueSkills,
        sharedJobAndCourseSkills: sharedSkills.length,
      },
      quality: jobs.validation.quality,
      consistency: {
        sharedSkillCount: sharedSkills.length,
        sharedSkillCoverageRate: jobSkillCoverageRate,
        sharedSkillExamples: sharedSkills.slice(0, 25),
        courseCatalogSupportsTopJobSkills: summarizeTopEntries(
          Array.from(jobSkillSet)
            .filter((skill) => courseSkillSet.has(skill))
            .map((skill) => ({
              skill,
              count: jobs.skillFacts.filter((fact) => fact.skill === skill).length,
            }))
        ),
      },
      datasets: {
        jobs: jobs.validation,
        courses: courses.validation,
      },
    },
  };
}

function writeProcessedArtifacts(preparedDataset) {
  ensureProcessedDir();
  fs.writeFileSync(JOB_POSTINGS_PATH, JSON.stringify(preparedDataset.jobPostings, null, 2));
  fs.writeFileSync(SKILL_FACTS_PATH, JSON.stringify(preparedDataset.skillFacts, null, 2));
  fs.writeFileSync(COURSE_CATALOG_PATH, JSON.stringify(preparedDataset.courseCatalog, null, 2));
  fs.writeFileSync(VALIDATION_SUMMARY_PATH, JSON.stringify(preparedDataset.validationSummary, null, 2));
}

export async function prepareResearchDataset({ force = false } = {}) {
  if (cachedPreparedDataset && !force) {
    return cachedPreparedDataset;
  }

  const [rawJobRows, rawCourseRows] = await Promise.all([
    readCsvRows(RAW_JOBS_DATASET_PATH),
    readCsvRows(RAW_COURSES_DATASET_PATH),
  ]);
  const preparedDataset = transformRows(rawJobRows, rawCourseRows);
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

export function readCourseCatalogFromDisk() {
  if (!fs.existsSync(COURSE_CATALOG_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(COURSE_CATALOG_PATH, "utf8"));
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
    rawJobsDatasetPath: RAW_JOBS_DATASET_PATH,
    rawCoursesDatasetPath: RAW_COURSES_DATASET_PATH,
    processedDir: PROCESSED_DIR,
    jobPostingsPath: JOB_POSTINGS_PATH,
    skillFactsPath: SKILL_FACTS_PATH,
    courseCatalogPath: COURSE_CATALOG_PATH,
    validationSummaryPath: VALIDATION_SUMMARY_PATH,
  };
}
