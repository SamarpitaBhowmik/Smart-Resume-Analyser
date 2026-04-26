# Algorithms Used in CareerAlign

This document explains the actual algorithms used in the project, based on the current codebase. It focuses on how each feature works internally, what data it uses, and what scoring or rule logic drives the output.

For system-level behavior, routes, UI screens, and datasets, also see:
- `README.md`
- `PROJECT_FUNCTIONALITY.md`
- `TECHNICAL_IMPLEMENTATION.md`
- `SYSTEM_EXPLANATION.md`

## 1. Resume Upload, Extraction, and Parsing

**Primary file:** `backend/routes/ResumeRoutes.js`

### Goal

Convert an uploaded PDF resume into a structured machine-readable object that the rest of the system can analyze.

### Input

- PDF file uploaded through `multipart/form-data`

### Output

- Structured resume object stored in MongoDB with:
  - `name`
  - `skills`
  - `experience`
  - `projects`
  - `education`
  - `email`
  - `phone`
  - `text`

### Algorithm

The project uses an **AI-assisted document parsing algorithm** with JSON normalization.

### How it works

1. The uploaded PDF is read into memory using `multer.memoryStorage()`.
2. The file buffer is converted to Base64.
3. The Base64 PDF is sent to Gemini along with a strict prompt that requests a JSON object with a fixed schema.
4. The raw model response is cleaned by removing markdown wrappers such as code fences.
5. A JSON substring is extracted using a regular expression that finds the outer `{...}` block.
6. The JSON is parsed.
7. Every array-like field is normalized:
   - if already an array, it is validated
   - if it is a string, the code tries to parse it as JSON
   - if parsing fails, the string is wrapped into a one-element array
   - malformed values that look like broken code are rejected
8. The cleaned result is stored in MongoDB in the `Resume` model under `extracted`.

### Why this algorithm is used

- Resumes are semi-structured and vary heavily in format.
- Gemini handles PDF content directly, so no custom OCR/parser pipeline is needed.
- The normalization phase makes the AI output safe for downstream scoring and matching.

## 2. Resume Representation

**Primary file:** `backend/models/Resume.js`

### Goal

Represent each resume in a structured format that supports both storage and analysis.

### Data structure

Each resume is stored with:

- raw file metadata
- PDF binary data
- extracted structured content

The extracted representation includes:

- `skills: [String]`
- `experience: [Mixed]`
- `projects: [Mixed]`
- `education: [Mixed]`

This is the project's practical implementation of the structured resume representation used by the rest of the pipeline.

## 3. Skill and Title Normalization

**Primary file:** `backend/utils/normaliseSkills.js`

### Goal

Convert noisy skill strings and job titles into canonical forms so matching is consistent.

### Algorithm

The project uses a **rule-based normalization algorithm**.

### How it works for skills

1. Convert text to lowercase.
2. Remove punctuation patterns such as parentheses and slash variants.
3. Collapse repeated whitespace.
4. Remove weak modifiers such as:
   - `basics`
   - `fundamentals`
   - `intro`
   - `awareness`
   - `knowledge of`
5. Look up the cleaned skill in `skillAliasMap.json`.
6. Replace aliases with a canonical form, for example:
   - `reactjs -> react`
   - `nodejs -> node.js`

### How it works for titles

1. Normalize case and punctuation.
2. Tokenize the title.
3. Remove generic role stopwords such as:
   - `engineer`
   - `developer`
   - `analyst`
   - `manager`
4. Join the remaining title tokens into a normalized role key.

### Why this algorithm is used

- Exact string matching is unreliable for resumes and job descriptions.
- Canonicalization makes set comparison and market analytics much more stable.

## 4. Research Dataset Preparation

**Primary file:** `backend/utils/datasetPipeline.js`

### Goal

Transform raw CSV job-role data into clean benchmark datasets for recommendation, matching, and market analytics.

### Input

- `backend/data/jobs.csv`

### Outputs

- `job_postings.json`
- `skill_facts.json`
- `course_catalog.json`
- `validation-summary.json`

### Algorithm

The project uses a **deterministic ETL and validation pipeline**.

### How it works

1. Read raw CSV rows using `csv-parser`.
2. For each row:
   - validate that title, YOE, and skills are present
   - parse the YOE text into structured min/max/mid values
   - normalize the title
   - normalize all skills
3. Reject rows that fail validation.
4. Remove duplicates using a composite deduplication key:
   - normalized title
   - normalized YOE label
   - normalized skills
5. Build a cleaned benchmark `job` object.
6. Expand each job into multiple `skill fact` rows, one for each skill.
7. Compute validation statistics such as:
   - retained row rate
   - duplicate count
   - invalid YOE count
   - top normalized titles
   - top normalized skills
8. Write processed JSON artifacts to disk.
9. If needed, load the processed data into MongoDB.

### Why this algorithm is used

- It turns raw benchmark data into analysis-ready structured evidence.
- It separates job-level records from skill-level facts, which is useful for demand modeling.

## 5. Benchmark Context Construction

**Primary file:** `backend/utils/benchmarkContext.js`

### Goal

Build a reusable in-memory knowledge layer for market demand and role-based scoring.

### Algorithm

The project uses a **precomputed benchmark-context algorithm**.

### How it works

1. Load processed job postings and skill facts from disk.
2. Build global maps for:
   - total demand per skill
   - demand per skill by YOE band
   - expected YOE per skill
   - skill co-occurrence
   - role profiles
3. For each job posting:
   - normalize title and skills
   - update role-specific skill counts
   - update YOE-specific role skill counts
   - update co-occurrence counts for skill pairs
4. Cache the result so it can be reused by matching, roadmap, and analytics features.

### Main outputs produced by this context

- `getGlobalSkillDemandScore(skill)`
- `getExpectedSkillYoe(skill, roleTitles, yoeLabel)`
- `getAdjacentSkills(skill)`
- `getRoleNeedScore(skill, roleTitles, yoeLabel)`
- `findRelevantRoles(targetSkills, titleCandidates)`

### Why this algorithm is used

- It avoids recomputing market statistics on every request.
- It makes the system explainable because later scores can be traced back to benchmark evidence.

## 6. Job Requirement Extraction from a Job Description

**Primary file:** `backend/utils/jobRequirementExtractor.js`

### Goal

Extract role titles and required skills from a free-text job description.

### Algorithm

The project uses a **hybrid extraction algorithm**:

- deterministic extraction first
- Gemini fallback only when confidence is low

### How deterministic extraction works

1. Build a dictionary of known terms from:
   - `skillAliasMap.json`
   - benchmark-known skills
2. Normalize the job description text.
3. Search for known skill terms inside the normalized text.
4. Add all matched canonical skills to a set.

### How title candidate extraction works

1. Normalize the job description.
2. Compare it with benchmark-known titles.
3. Compute a title score from:
   - direct phrase match
   - token overlap
4. Keep the top title candidates above a threshold.

### Confidence scoring

The extraction confidence is estimated as:

`confidence = min(95, skills_found * 16 + title_candidates * 8)`

### Gemini fallback logic

If too few skills are found or confidence is low:

1. Gemini is prompted to extract technical skills as a JSON array.
2. Fallback skills are normalized.
3. Deterministic and Gemini skills are merged.
4. Confidence is boosted, but the extraction method is marked accordingly.

### Why this algorithm is used

- Deterministic extraction is more explainable and reproducible.
- The fallback preserves robustness for unusual job descriptions.

## 7. Resume Experience Estimation

**Primary file:** `backend/utils/jobMatching.js`

### Goal

Estimate years of experience from resume work history.

### Algorithm

The project uses a **heuristic duration-parsing algorithm**.

### How it works

1. Read each item in the resume's `experience` field.
2. Extract a duration string from:
   - `duration`
   - `date`
   - raw string items
3. Try to detect:
   - year ranges such as `2021 - 2023`
   - month spans such as `18 months`
   - year spans such as `2 years`
4. Convert each experience span into an approximate numeric value in years.
5. Average the extracted spans.
6. If no explicit durations can be parsed, use a fallback estimate based on the number of experience entries.

### Why this algorithm is used

- Resumes express duration in many inconsistent formats.
- An approximate numeric YOE value is needed for experience-aware scoring.

## 8. Skill Comparison and Gap Detection

**Primary file:** `backend/utils/jobMatching.js`

### Goal

Determine which job skills are already covered by the resume and which are missing.

### Algorithm

The project uses a **canonical set-comparison algorithm**.

### How it works

1. Normalize resume skills into canonical form.
2. Normalize job skills into canonical form.
3. Build two maps:
   - resume canonical skill -> original resume string
   - job canonical skill -> original job string
4. For each job skill:
   - if the canonical skill exists in the resume map, mark it as matched
   - otherwise mark it as missing
5. Compute:
   - `matchedSkills`
   - `missingSkills`
   - `matchedCanonical`
   - `missingCanonical`
   - `semanticMatches` when the original strings differ but normalize to the same canonical skill

### Exact skill coverage score

`exactSkillCoverageScore = matched_job_skills / total_job_skills * 100`

### Why this algorithm is used

- Matching on canonical skill forms makes the gap analysis more realistic than plain string comparison.

## 9. Semantic Similarity Between Resume and Job Description

**Primary file:** `backend/controllers/analysisController.js`

### Goal

Measure how semantically similar the resume evidence is to the target job description.

### Algorithm

The project uses an **embedding-based cosine similarity algorithm** with a token-overlap fallback.

### How the embedding path works

1. Build a resume evidence string from:
   - skills
   - experience text
   - project text
2. Embed the resume evidence text.
3. Embed the job description text.
4. Compute cosine similarity:

`sim(A, B) = (A . B) / (||A|| ||B||)`

5. Convert the similarity to a percentage score.

### Fallback path

If the embedding API/model is unavailable:

1. Tokenize both texts.
2. Remove very short tokens.
3. Compute token overlap over the union of unique tokens.
4. Use that as an approximate semantic score.

### Why this algorithm is used

- Embeddings capture related meaning beyond exact keyword overlap.
- The fallback keeps the system usable even when embedding support is unavailable.

## 10. Experience Alignment Scoring

**Primary file:** `backend/utils/jobMatching.js`

### Goal

Measure how well the candidate's estimated experience aligns with the job's required experience.

### Algorithm

The project uses a **rule-based experience-fit scoring algorithm**.

### How it works

1. Compare `resumeYears` with `yoeMin` and `yoeMax`.
2. Apply scoring rules:
   - perfect score if experience lies inside the target range
   - penalize if the candidate is below the range
   - mildly penalize if above the range
   - use a neutral or down-weighted score when data is unreliable
3. Return both a numeric score and a natural-language explanation.

### Why this algorithm is used

- Experience fit is not binary; near matches still have value.

## 11. Skill-Level Fit Scoring

**Primary file:** `backend/utils/jobMatching.js`

### Goal

Measure not only whether a skill exists on the resume, but whether the candidate likely has it at the required maturity for the target role and YOE band.

### Algorithm

The project uses a **skill-maturity evidence algorithm**.

### How it works

For each job skill:

1. Estimate the expected YOE for that skill using benchmark data.
2. Compute the global market demand score for that skill.
3. Check whether the skill is present on the resume.
4. If present:
   - reward strongly if resume YOE is near or above expected maturity
   - assign a reduced score if the skill is present but maturity appears below target
5. If missing:
   - assign `0`
   - mark high-demand missing skills separately
6. Average the per-skill fit scores to produce the final `skillLevelFitScore`.

### Why this algorithm is used

- A junior candidate listing a skill is not equivalent to senior-level readiness in that skill.

## 12. Role Co-occurrence Fit

**Primary file:** `backend/utils/jobMatching.js`

### Goal

Measure how strongly the resume's skill set resembles the skill bundles typically seen together in benchmark role profiles.

### Algorithm

The project uses a **role-support / co-occurrence algorithm** backed by benchmark role profiles.

### How it works

1. Use the benchmark context to inspect the target role.
2. Compare the candidate's skills against skill bundles common for that role and YOE band.
3. Return a support score showing how much benchmark evidence exists for the resume's skill pattern inside that role family.

### Why this algorithm is used

- Real-world roles often depend on combinations of skills, not isolated terms.

## 13. Hybrid Resume-to-Job Match Scoring

**Primary files:** `backend/controllers/analysisController.js`, `backend/utils/jobMatching.js`

### Goal

Produce the final job match percentage used by the system.

### Algorithm

The project uses a **weighted hybrid scoring model** called `hybrid-v2`.

### Formula

`finalScore = 0.35 exact skill coverage + 0.20 skill level fit + 0.20 semantic similarity + 0.15 experience alignment + 0.10 role co-occurrence fit`

### How it works

1. Extract job requirements.
2. Estimate resume experience.
3. Compute:
   - exact skill coverage score
   - skill-level fit score
   - semantic similarity score
   - experience alignment score
   - role co-occurrence fit score
4. Combine all component scores with the weighted formula above.
5. Persist the full score breakdown in `latestAnalysis`.

### Why this algorithm is used

- It balances deterministic evidence, semantic evidence, and role-market context.
- It is more defensible than a single-score embedding match.

## 14. Resume Linguistic Quality Scoring

**Primary file:** `backend/utils/resumeQuality.js`

### Goal

Measure how strongly the resume communicates achievement and impact.

### Algorithm

The project uses a **statement-level heuristic scoring algorithm**.

### How statements are built

1. Collect textual statements from:
   - experience descriptions
   - project descriptions
   - summaries
2. Split on bullets, lines, and separators.
3. Remove very short fragments.
4. Deduplicate statements.

### Statement-level features

Each statement is scored on:

1. **Action verb strength**
   - highest score when the first word is a strong action verb such as `built`, `designed`, `led`, `optimized`
2. **Measurable impact**
   - high score when the statement includes numbers, percentages, money, counts, or scope
3. **Clarity and specificity**
   - penalizes vague wording such as `worked on` or `responsible for`
   - adjusts for overly short or overly long statements
   - rewards clearer implementation wording such as `using`, `with`, `through`

### Statement formula

`statementScore = 0.30 actionVerb + 0.40 measurableImpact + 0.30 clarity`

### Resume-level score

1. Score every statement.
2. Average each feature category across all statements.
3. Recompute the final overall score using the same weighted formula.
4. Assign a confidence label:
   - `High`
   - `Medium`
   - `Low`
5. Generate strengths, improvement areas, and per-statement suggestions.

### Why this algorithm is used

- It produces interpretable feedback instead of a black-box writing score.

## 15. Missing Skill Priority Ranking

**Primary file:** `backend/utils/skillPriorityEngine.js`

### Goal

Rank missing skills by which ones should be learned first.

### Algorithm

The project uses a **multi-factor deterministic priority model**.

### Factors used

For each missing skill, the system computes:

1. **Target role need score**
   - how central the skill is to relevant benchmark roles
2. **Global market demand score**
   - how often the skill appears in the benchmark dataset
3. **Target YOE demand score**
   - how active the skill is in the target experience band
4. **Readiness score**
   - how prepared the candidate is to learn it based on prerequisites, adjacent skills, and current level
5. **Effort inverse score**
   - quicker-to-learn skills receive a higher score
6. **Focus boost**
   - optional extra weight if the user selected a focus skill

### Formula

`priorityScore = 0.35 roleNeed + 0.25 marketDemand + 0.15 targetYoeDemand + 0.15 readiness + 0.10 effortInverse + focusBoost`

### How readiness is computed

1. Read prerequisite skills from `learningData`.
2. Measure how many prerequisites already exist on the resume.
3. Measure how many adjacent skills already exist on the resume.
4. Compare the candidate's current level against the target level for that skill.
5. Combine these into one readiness score.

### Why this algorithm is used

- It avoids recommending skills only because they are popular.
- It balances demand, relevance, and learnability.

## 16. Evidence-Backed Roadmap Generation

**Primary file:** `backend/utils/roadmapBuilder.js`

### Goal

Generate a practical learning roadmap without relying on free-form AI generation.

### Algorithm

The project uses a **deterministic roadmap construction algorithm**.

### How it works

1. Run the missing-skill priority engine.
2. Select the top priority skills.
3. For each high-priority skill:
   - load its learning profile
   - fetch matching catalog entries from the curated course catalog
4. Score each catalog item using:
   - skill priority
   - level fit
   - provider trust
   - hands-on value
   - direct catalog match
5. Assign each item to a roadmap phase:
   - `Foundation`
   - `Core Role Alignment`
   - `Portfolio / Applied Practice`
6. Deduplicate repeated items.
7. Build grouped outputs:
   - phases
   - courses
   - projects
   - resources
8. Estimate a total timeline from the selected items.

### Catalog item scoring formula

`itemScore = 0.45 skillPriority + 0.20 levelFit + 0.15 providerTrust + 0.10 handsOn + 0.10 catalogMatch`

### Why this algorithm is used

- It makes roadmap generation reproducible and explainable.
- It ensures recommendations are tied to both role fit and available learning resources.

## 17. Job Suggestions Against Benchmark Roles

**Primary file:** `backend/controllers/analysisController.js`

### Goal

Recommend the best matching benchmark roles for a resume.

### Algorithm

The project uses the same **hybrid-v2 scoring algorithm** used for resume-vs-JD matching, but applies it to each benchmark job in the dataset.

### How it works

1. Read the candidate resume.
2. Iterate through benchmark jobs.
3. For each job, compute:
   - exact skill coverage
   - skill-level fit
   - semantic score
   - experience alignment
   - role co-occurrence fit
4. Build the final hybrid score.
5. Sort jobs by score.
6. Return the top matches with full component breakdowns.

### Why this algorithm is used

- It connects the candidate to benchmark role families, not just the pasted job description.

## 18. Market Intelligence and Role-Lift Simulation

**Primary file:** `backend/utils/marketInsights.js`

### Goal

Explain why a missing skill matters and how much it could improve the candidate's role fit.

### Endpoints (where it is used)
- `GET /api/analytics/global-insights?focusSkill=...` (benchmark-only mode)
- `GET /api/analytics/user-insights?resumeId=...&focusSkill=...` (candidate mode)

### Algorithm

The project uses a **contextual market-insights algorithm** built on top of the roadmap and benchmark context.

### Main sub-algorithms

#### 18.1 Demand curve construction

1. Read demand-by-YOE data for the selected skill.
2. Normalize each YOE band's demand against the maximum observed demand.
3. Mark:
   - candidate band
   - target band
   - peak band

#### 18.2 Maturity summary

1. Inspect per-skill evidence from the latest analysis.
2. Count how many skills are:
   - ready now
   - below target maturity
   - high-impact missing
   - other missing
3. Build summary charts and top warning signals.

#### 18.3 Adjacent skill series

1. Read benchmark co-occurrence data for the selected skill.
2. Mark which adjacent skills are already present on the resume.

#### 18.4 Role-impact simulation

This is the project's "what if I learn this skill?" algorithm.

1. Add the selected focus skill to the resume skill set.
2. Recompute projected role scores for top benchmark jobs using:
   - exact skill coverage
   - skill-level fit
   - role co-occurrence fit
3. Keep semantic and experience baselines stable.
4. Compare projected fit vs current fit.
5. Report:
   - average lift
   - maximum lift
   - per-role uplift

### Why this algorithm is used

- It turns market analytics into personalized evidence instead of generic dashboards.

## 19. Research Report Construction

**Primary file:** `backend/utils/reportBuilder.js`

### Goal

Assemble all computed outputs into a final report object and optional PDF.

### Endpoints (where it is used)
- `GET /api/report/:resumeId`
- `GET /api/report/:resumeId/pdf`

### Algorithm

The project uses a **report aggregation algorithm**.

### How it works

1. Load the target resume.
2. Load cached `latestAnalysis` and `latestResumeQuality`.
3. If required, rebuild derived outputs such as:
   - roadmap
   - missing-skill demand
   - missing-skill trend
   - related skills
   - benchmark job suggestions
4. Build a single report object with:
   - metadata
   - summary
   - resume snapshot
   - job analysis
   - resume quality
   - recommendations
   - market evidence
   - validation summary
   - methodology summary
5. The PDF generator then formats this report into a downloadable file.

### Why this algorithm is used

- It centralizes all computed evidence into one consistent output for the user.

## 20. End-to-End Analysis Pipeline

**Primary file:** `backend/controllers/analysisController.js`

### Goal

Run the full resume-vs-job analysis in one request.

### Full workflow

1. Validate `resumeId` and `jobDescription`.
2. Load the resume from MongoDB.
3. Extract job YOE from the job description.
4. Extract job skills and title candidates using the hybrid requirement extractor.
5. Normalize resume skills.
6. Build skill comparison and skill gaps.
7. Estimate resume experience years.
8. Infer the target YOE band.
9. Compute:
   - skill-level fit
   - experience alignment
   - role co-occurrence fit
   - semantic similarity
10. Combine scores into the final hybrid match percentage.
11. Compute resume quality.
12. Build the evidence-backed roadmap.
13. Save all outputs into:
   - `latestResumeQuality`
   - `latestAnalysis`
14. Return the analysis response to the frontend.

### Why this matters

This controller is where all major algorithms come together into one production pipeline.

## 21. Summary of Core Formulas

### Hybrid job match

`0.35 exact skill coverage + 0.20 skill level fit + 0.20 semantic similarity + 0.15 experience alignment + 0.10 role co-occurrence fit`

### Resume quality

`0.30 action verb strength + 0.40 measurable impact + 0.30 clarity/specificity`

### Missing-skill priority

`0.35 target role need + 0.25 market demand + 0.15 target YOE demand + 0.15 readiness + 0.10 effort inverse + optional focus boost`

### Roadmap item ranking

`0.45 skill priority + 0.20 level fit + 0.15 provider trust + 0.10 hands-on value + 0.10 catalog match`

## 22. Important Note

The project is not purely AI-driven in the black-box sense. AI is used mainly for:

- PDF resume parsing
- low-confidence job-skill extraction fallback
- semantic embeddings

The main recommendation, ranking, market analytics, and roadmap logic are deterministic and benchmark-driven.
