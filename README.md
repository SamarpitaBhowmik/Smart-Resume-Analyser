# CareerAlign

CareerAlign is a resume intelligence SaaS product built around four connected decisions:

1. How well does this resume fit a target job description?
2. Which missing skill matters most right now?
3. Why was that skill prioritized?
4. What should the user learn next, and in what order?

This README is the canonical explanation of how the project works under the hood.

## What The Product Does

The product currently has four main user-facing layers:

1. Resume upload and parsing
2. Resume vs job-description analysis
3. Evidence-backed roadmap generation
4. Contextual market analytics

There is also a separate resume-only recommendation workflow:

- upload a resume without a job description
- rank benchmark roles from resume evidence alone
- expose recommendation confidence and reasoning separately from JD matching

The main app shell now keeps those layers visually consistent:

- the intake form lives in a single top hero instead of a left-side rail
- dashboard results expand below in full-width sections
- dashboard, analytics, and report pages share the same blue-toned landing-page palette

The analytics page is no longer a generic chart page. It now exists to justify the roadmap and answer practical user questions:

- Which gap should I fix first?
- Why that one?
- Is it relevant at my experience level?
- How much does it improve my strongest role matches?
- Which adjacent skills should I learn with it?

The analytics route now supports two modes:

- standalone benchmark mode when no resume has been analyzed yet
- contextual candidate mode when a `resumeId` is present

## High-Level Architecture

### Frontend

- Dashboard: [`frontend/src/components/Dashboard.jsx`](frontend/src/components/Dashboard.jsx)
- Resume-only recommendations: [`frontend/src/components/ResumeRecommendations.jsx`](frontend/src/components/ResumeRecommendations.jsx)
- Market analytics: [`frontend/src/components/AnalyticsDashboard.jsx`](frontend/src/components/AnalyticsDashboard.jsx)
- Report page: [`frontend/src/components/ResearchReport.jsx`](frontend/src/components/ResearchReport.jsx)
- Shared visual shell and theme utilities: [`frontend/src/index.css`](frontend/src/index.css)
- API helpers: [`frontend/src/utils/api.js`](frontend/src/utils/api.js), [`frontend/src/utils/analyticsApi.js`](frontend/src/utils/analyticsApi.js)

### Backend

- Main analysis controller: [`backend/controllers/analysisController.js`](backend/controllers/analysisController.js)
- Analytics routes: [`backend/routes/analyticsRoutes.js`](backend/routes/analyticsRoutes.js)
- Matching logic: [`backend/utils/jobMatching.js`](backend/utils/jobMatching.js)
- Job requirement extraction: [`backend/utils/jobRequirementExtractor.js`](backend/utils/jobRequirementExtractor.js)
- Skill priority engine: [`backend/utils/skillPriorityEngine.js`](backend/utils/skillPriorityEngine.js)
- Roadmap builder: [`backend/utils/roadmapBuilder.js`](backend/utils/roadmapBuilder.js)
- Market intelligence service: [`backend/utils/marketInsights.js`](backend/utils/marketInsights.js)
- Benchmark dataset preparation: [`backend/utils/datasetPipeline.js`](backend/utils/datasetPipeline.js)
- Benchmark context loader: [`backend/utils/benchmarkContext.js`](backend/utils/benchmarkContext.js)

## Data Flow

### 1. Resume Upload

The user uploads a PDF resume.

- The file is stored in MongoDB through [`backend/routes/ResumeRoutes.js`](backend/routes/ResumeRoutes.js)
- Parsed resume data is stored in the `Resume` document under `extracted`

Stored resume fields include:

- name
- email
- phone
- raw text
- skills
- experience
- education
- projects

### 2. Resume + JD Analysis

When the user pastes a job description and clicks analyze:

- the backend loads the resume
- extracts job requirements
- normalizes both resume skills and job skills
- estimates experience years from the resume
- computes fit using the hybrid-v2 model
- computes resume quality
- computes missing-skill priority
- builds the roadmap
- persists the full result inside the resume document as `latestAnalysis`

Job suggestions now use a recommendation score, not only the base hybrid match:

- base hybrid fit from skills, maturity, semantics, experience, and role co-occurrence
- title alignment to the extracted target role family
- demand alignment comparing matched-skill demand against remaining gap pressure
- recommendation confidence so suggestions can be interpreted as strong, medium, or exploratory

Main entry point:

- [`backend/controllers/analysisController.js`](backend/controllers/analysisController.js)

### 3. Roadmap Generation

The roadmap is not AI-generated anymore.

It is created deterministically from:

- missing canonical skills
- resume skills
- candidate experience
- target role needs
- market demand
- normalized online course catalog built from `Online_Courses.csv` plus curated fallback entries
- curated skill learning map

Main files:

- [`backend/utils/roadmapBuilder.js`](backend/utils/roadmapBuilder.js)
- `backend/data/processed/course_catalog.json`
- `backend/data/courseCatalog.json`
- `backend/data/skillLearningMap.json`

### 4. Market Analytics

The analytics page now has two layers.

Standalone benchmark mode answers:

- which skills dominate the benchmark market
- which role families are most developed
- how demand shifts by experience band
- which skills co-occur with a selected spotlight skill
- which learning options map to that spotlight skill

Candidate mode uses the user’s latest analysis and roadmap as context.

Instead of generic graphs, it builds a contextual analytics payload that answers:

- which missing skills are highest priority
- when the focus skill matters by experience band
- which nearby skills should be learned with it
- how much top role matches improve if that skill is closed
- whether the user already has depth in the required skills

Main file:

- [`backend/utils/marketInsights.js`](backend/utils/marketInsights.js)

## Datasets

The project now uses two raw CSV datasets and three processed research artifacts.

Raw inputs:

- `backend/data/jobs.csv`
- `backend/data/Online_Courses.csv`

### Dataset A: Job Postings

Stored as processed JSON and MongoDB collection:

- `backend/data/processed/job_postings.json`

Each record contains:

- `jobId`
- `title`
- `normalizedTitle`
- `description`
- `experienceText`
- `yoeMin`
- `yoeMax`
- `yoeMid`
- `yoeLabel`
- `skills`
- `datasetVersion`

### Dataset B: Skill Facts

Stored as processed JSON and MongoDB collection:

- `backend/data/processed/skill_facts.json`

Each record is one `(jobId, skill)` fact and contains:

- `jobId`
- `title`
- `normalizedTitle`
- `skill`
- `yoeMin`
- `yoeMax`
- `yoeMid`
- `yoeLabel`
- `datasetVersion`

### Dataset C: Course Catalog

Stored as processed JSON and loaded directly by the roadmap engine:

- `backend/data/processed/course_catalog.json`

Each course record contains:

- `course_id`
- `title`
- `provider`
- `url`
- `skills_covered`
- `level`
- `estimated_hours`
- `estimated_weeks`
- `format`
- `provider_trust_score`
- `hands_on_score`
- `cost_type`
- `prerequisites`
- `source_type`

### Skill Alias Map

Canonical skill normalization is driven by:

- `backend/data/skillAliasMap.json`

This collapses synonyms such as:

- `reactjs -> react`
- `js -> javascript`
- `nodejs -> node.js`

### Dataset Validation

The benchmark dataset is cleaned through [`backend/utils/datasetPipeline.js`](backend/utils/datasetPipeline.js).

Validation includes:

- missing required field checks
- duplicate detection
- title normalization
- skill normalization
- YOE normalization
- course metadata normalization
- metadata-based skill inference for courses with blank `Skills`
- URL validation for learning resources
- suspicious encoding and outlier checks
- cross-dataset consistency checks between job skills and course skills
- merged processed course catalog generation
- processed artifact generation

Validation summary artifact:

- `backend/data/processed/validation-summary.json`

Current processed snapshot:

- benchmark job postings: `984`
- skill facts: `12,247`
- normalized course catalog entries: `5,309`
- raw normalized course rows retained from `Online_Courses.csv`: `5,275`
- metadata-inferred course-skill rows: `3,181`
- shared job/course skills: `335`
- shared skill coverage rate: `18.8%`
- retained job row rate: `92.13%`

## Where Gemini Is Used And Where It Is Not

One major design goal in this version is to reduce shallow AI dependence.

### Gemini Is Used For

- PDF resume parsing
- JD skill extraction only as fallback when deterministic extraction confidence is low
- semantic similarity embeddings when available

### Gemini Is Not Used For

- roadmap ordering
- course selection
- market analytics logic
- missing-skill priority ranking
- experience-aware fit calculation
- role-lift analytics

That means the core product decisions are now deterministic and explainable.

## Core Algorithms

## 1. Job Requirement Extraction

File:

- [`backend/utils/jobRequirementExtractor.js`](backend/utils/jobRequirementExtractor.js)

Logic:

1. Try deterministic extraction using known skill aliases and role keywords
2. Estimate extraction confidence
3. Use Gemini fallback only if confidence is low

This makes the JD pipeline more research-defensible than fully AI-generated extraction.

## 2. Resume Experience Estimation

File:

- [`backend/utils/jobMatching.js`](backend/utils/jobMatching.js)

Function:

- `estimateResumeExperienceYears()`

Logic:

- read date spans or duration strings from experience entries
- convert them into approximate year spans
- average valid spans
- if no usable span exists, use a conservative fallback from count of experience entries

This estimated experience is reused across:

- job-fit scoring
- skill maturity evaluation
- roadmap level fit
- experience-band analytics

## 3. Skill Comparison

File:

- [`backend/utils/jobMatching.js`](backend/utils/jobMatching.js)

Function:

- `buildSkillComparison()`

Logic:

- normalize resume skills
- normalize job skills
- compare canonical forms
- separate them into:
  - matched skills
  - missing skills
  - semantic matches caused by alias normalization

Output includes exact skill coverage score:

`exact_skill_coverage = matched_canonical_skills / total_job_skills * 100`

## 4. Experience-Aware Skill Level Fit

File:

- [`backend/utils/jobMatching.js`](backend/utils/jobMatching.js)

Function:

- `computeSkillLevelFit()`

Logic:

For every required job skill:

1. Look up the expected maturity level from benchmark data
2. Compare that expected maturity to estimated resume experience
3. Classify each skill into one of:
   - `matched_at_target_level`
   - `matched_below_target_maturity`
   - `matched_unknown_maturity`
   - `missing_high_impact`
   - `missing`

This is the piece that makes matching experience-aware instead of just overlap-based.

## 5. Hybrid-V2 Job Matching

File:

- [`backend/utils/jobMatching.js`](backend/utils/jobMatching.js)

Formula:

`final_score = 0.35 * exact_skill_coverage + 0.20 * skill_level_fit + 0.20 * semantic_similarity + 0.15 * experience_alignment + 0.10 * role_cooccurrence_fit`

### Component Meanings

- `exact_skill_coverage`
  - canonical overlap between resume and role skills
- `skill_level_fit`
  - whether matched skills are at the expected maturity for the target band
- `semantic_similarity`
  - embedding similarity when available, lexical fallback otherwise
- `experience_alignment`
  - whether resume years align with role YOE range
- `role_cooccurrence_fit`
  - whether the user’s skills commonly appear together inside that role benchmark

This same matching family is used for:

- main JD fit
- job recommendations
- role-fit decomposition

## 6. Resume Quality Scoring

File:

- `backend/utils/resumeQuality.js`

Formula:

`resume_quality = 0.30 * action_verb_strength + 0.40 * measurable_impact + 0.30 * clarity_specificity`

This score is intentionally kept separate from job fit so the product does not mix writing quality with role suitability.

## 7. Skill Priority Engine

File:

- `backend/utils/skillPriorityEngine.js`

Formula:

`priority_score = 0.35 * target_role_need + 0.25 * market_demand + 0.15 * target_yoe_demand + 0.15 * readiness + 0.10 * effort_inverse`

### Component Meanings

- `target_role_need`
  - how strongly the skill is associated with the inferred target role benchmark
- `market_demand`
  - global demand for that skill in the benchmark dataset
- `target_yoe_demand`
  - demand for that skill in the target experience band
- `readiness`
  - whether the user already has the prerequisites and nearby skills to learn it efficiently
- `effort_inverse`
  - skills with smaller learning effort get a small boost when impact is otherwise similar

This score drives:

- missing-skill order on the dashboard
- roadmap focus skill
- analytics priority chart
- highest-impact missing skill

## 8. Roadmap Item Ranking

File:

- `backend/utils/roadmapBuilder.js`

Roadmap items come from the curated course catalog, not AI.

Item scoring combines:

- selected skill priority
- catalog skill match
- level fit
- provider trust
- hands-on value

The roadmap builder then groups items into:

- Foundation
- Core Role Alignment
- Portfolio / Applied Practice

## 9. Market Intelligence Page

File:

- `backend/utils/marketInsights.js`

The market analytics page now uses one contextual payload.

It computes:

### A. Priority Map

Top missing skills ranked by the same priority engine used in roadmap generation.

### B. Demand Timing Curve

For the selected skill:

- demand by YOE band
- candidate’s current band
- target band
- peak-demand band

This answers: `why now?`

### C. Role Lift Simulation

For the selected skill:

1. take the user’s top benchmark role matches
2. add the selected skill to the resume skill set
3. recompute exact coverage, skill-level fit, and role co-occurrence support
4. keep semantic and experience baselines stable
5. compare `current_fit` vs `projected_fit`

This answers: `what changes if I learn this skill?`

### D. Skill Bundle Analysis

The page uses benchmark co-occurrence to show which skills usually appear with the selected skill in the same roles.

This answers: `what should I learn along with it?`

### E. Maturity Diagnostic

The page summarizes per-skill evidence into:

- ready now
- needs depth
- high-impact gap
- other gap

This answers: `do I have only breadth, or also enough depth?`

## Main APIs

### Resume And Analysis

- `POST /api/resume/upload`
- `POST /api/analysis/analyze`
- `POST /api/analysis/resume-quality`
- `POST /api/analysis/roadmap`
- `GET /api/analysis/job-suggestions`

### Analytics

- `GET /api/analytics/user-insights`
- `GET /api/analytics/top-skills`
- `GET /api/analytics/skills-by-yoe`
- `GET /api/analytics/job-titles`
- `GET /api/analytics/yoe-distribution`

The new analytics page mainly uses:

- `GET /api/analytics/user-insights?resumeId=...&focusSkill=...`

### Reporting

- `GET /api/report/:resumeId`
- `GET /api/report/:resumeId/pdf`

## How The Dashboard, Roadmap, And Analytics Stay In Sync

This is one of the most important design choices in the project.

The product now uses the same core evidence for all three surfaces:

- Dashboard uses `priorityRanking` and roadmap summary
- Roadmap uses the priority engine plus curated catalog
- Analytics uses the same priority ranking, selected focus skill, demand-by-band data, and role-impact simulation

That means the system is no longer behaving like:

- one AI for matching
- another AI for courses
- random charts on a separate page

Instead it behaves like a single decision-support pipeline.

## Files To Read First If You Want To Understand The Project Quickly

If you want the shortest path to understanding the codebase, read these in order:

1. [`backend/controllers/analysisController.js`](backend/controllers/analysisController.js)
2. [`backend/utils/jobMatching.js`](backend/utils/jobMatching.js)
3. [`backend/utils/skillPriorityEngine.js`](backend/utils/skillPriorityEngine.js)
4. [`backend/utils/roadmapBuilder.js`](backend/utils/roadmapBuilder.js)
5. [`backend/utils/marketInsights.js`](backend/utils/marketInsights.js)
6. [`frontend/src/components/AnalyticsDashboard.jsx`](frontend/src/components/AnalyticsDashboard.jsx)

## Local Verification

Backend tests:

- `cd backend`
- `npm test`

Frontend checks:

- `cd frontend`
- `npm run lint`

## Known Environment Constraint

Frontend production build was not fully verified on this machine because the current Node version is `20.17.0`, while the Vite setup expects `20.19+`.

## Bottom Line

The project is no longer structured as:

- upload resume
- call Gemini everywhere
- show charts separately

It is now structured as:

- parse
- normalize
- score
- prioritize
- recommend
- justify

That is the core logic of the current CareerAlign system.
