# CareerAlign

CareerAlign is a full-stack resume intelligence system that compares a candidate resume against a target job description, ranks missing skills, builds a deterministic learning roadmap, and explains the result with benchmark-based market analytics.

This file is the main documentation entry point for the current codebase.

## What The System Does

CareerAlign supports six primary workflows:

1. Upload a PDF resume and parse it into structured candidate data
2. Compare the resume against a pasted job description
3. Score resume writing quality separately from job fit
4. Recommend learning steps from a normalized course catalog
5. Show market analytics and report outputs that justify the recommendations
6. Batch assess and rank up to 10 candidate resumes (PDF/DOCX) against a job description for recruiters

It also supports a workflow where a user uploads only a resume and gets benchmark role suggestions without pasting a job description.

## Current Architecture

### Frontend

- Stack: React 19 + Vite + React Router + Recharts + Tailwind CSS
- Main routes:
  - `/`
  - `/dashboard`
  - `/resume-recommendations`
  - `/analytics`
  - `/report/:resumeId`
  - `/recruiter-assessment`

### Backend

- Stack: Node.js + Express + Mongoose
- Main responsibilities:
  - resume upload and Gemini-based PDF parsing
  - deterministic job requirement extraction with Gemini fallback
  - hybrid matching and recommendation logic
  - research dataset preparation and benchmark loading
  - analytics and report APIs

### Storage

- MongoDB stores uploaded resumes plus benchmark job and skill records
- Processed JSON artifacts are also written to `backend/data/processed`

## End-To-End Flow

### 1. Resume upload

Endpoint:

- `POST /api/resume/upload`

What happens:

- the frontend sends a PDF using `FormData`
- the backend sends the PDF to Gemini with a strict JSON extraction prompt
- the parsed result is normalized before save
- the resume is stored in MongoDB with the original file buffer and structured `extracted` data

Stored extracted fields include:

- `name`
- `skills`
- `experience`
- `projects`
- `education`
- `text`
- `email`
- `phone`

### 2. Resume + job description analysis

Endpoint:

- `POST /api/analysis/analyze`

What happens:

- load the resume from MongoDB
- extract job skills and title candidates
- estimate resume experience years from durations or date ranges
- compare canonical resume skills with canonical job skills
- compute hybrid job fit
- compute resume quality
- rank missing skills
- build a deterministic roadmap
- persist the result as `latestAnalysis` and `latestResumeQuality`

### 3. Resume-only role suggestions

Endpoint:

- `GET /api/analysis/job-suggestions?resumeId=...&limit=...`

What happens:

- shortlist benchmark roles using non-embedding signals first
- optionally use embeddings for richer ranking if available
- compute recommendation score, title alignment, demand alignment, and confidence
- apply diversity suppression to reduce repetitive results

### 4. Roadmap generation

Endpoint:

- `POST /api/analysis/roadmap`

What happens:

- reuse latest analysis context
- rank missing skills with the priority engine
- pick the selected or highest-impact focus skill
- select and score learning items from the normalized course catalog
- group the results into roadmap phases

### 5. Analytics and reporting

Endpoints:

- `GET /api/analytics/global-insights`
- `GET /api/analytics/user-insights`
- `GET /api/report/:resumeId`
- `GET /api/report/:resumeId/pdf`

What happens:

- global analytics shows benchmark-level demand and role patterns
- user analytics shows why a focus skill matters for that candidate
- the report combines fit, quality, roadmap, jobs, and dataset evidence
- PDF export renders the report to a downloadable file

## Matching And Recommendation Logic

### Hybrid job fit

The main fit score uses `hybrid-v2`:

`0.35 exact skill coverage + 0.20 skill level fit + 0.20 semantic similarity + 0.15 experience alignment + 0.10 role co-occurrence fit`

### Recommendation score for role suggestions

Role suggestions build on top of the hybrid score:

`0.70 base hybrid + 0.15 title alignment + 0.15 demand alignment`

### Resume quality

Resume quality is separate from role fit:

`0.30 action verb strength + 0.40 measurable impact + 0.30 clarity/specificity`

### Missing-skill priority

The roadmap and analytics use:

`0.35 target role need + 0.25 market demand + 0.15 target YOE demand + 0.15 readiness + 0.10 effort inverse`

## AI Usage Vs Deterministic Logic

### Gemini is used for

- PDF resume parsing
- low-confidence fallback job requirement extraction
- semantic embeddings when the embedding API/model is available

### Deterministic logic is used for

- skill normalization
- job-fit assembly and component weighting
- experience estimation
- title alignment
- role co-occurrence support
- missing-skill prioritization
- roadmap ranking and phase grouping
- market analytics calculations
- role-lift simulation

## Datasets

### Raw inputs

- `backend/data/jobs.csv`
- `backend/data/Online_Courses.csv`

### Processed artifacts

- `backend/data/processed/job_postings.json`
- `backend/data/processed/skill_facts.json`
- `backend/data/processed/course_catalog.json`
- `backend/data/processed/validation-summary.json`

### Current processed snapshot

From `backend/data/processed/validation-summary.json`:

- dataset version: `research-dataset-2025-12-14`
- benchmark job postings: `984`
- skill facts: `12,247`
- unique normalized titles: `218`
- unique normalized job skills: `1,782`
- course catalog entries: `5,309`
- shared job/course skills: `335`
- retained job row rate: `92.13%`

## Main Files To Read

If you want the fastest path through the codebase, read these first:

1. `backend/controllers/analysisController.js`
2. `backend/utils/jobMatching.js`
3. `backend/utils/skillPriorityEngine.js`
4. `backend/utils/roadmapBuilder.js`
5. `backend/utils/marketInsights.js`
6. `backend/utils/datasetPipeline.js`
7. `frontend/src/components/Dashboard.jsx`
8. `frontend/src/components/AnalyticsDashboard.jsx`
9. `frontend/src/components/ResearchReport.jsx`

## API Summary

### Resume

- `POST /api/resume/upload`

### Recruiter

- `POST /api/recruiter/upload`

### Analysis

- `POST /api/analysis/analyze`
- `POST /api/analysis/resume-quality`
- `POST /api/analysis/roadmap`
- `GET /api/analysis/job-suggestions`

### Analytics

- `GET /api/analytics/global-insights`
- `GET /api/analytics/user-insights`
- `GET /api/analytics/top-skills`
- `GET /api/analytics/skills-by-yoe`
- `GET /api/analytics/skills-by-title/:title`
- `GET /api/analytics/job-titles`
- `GET /api/analytics/yoe-distribution`
- `GET /api/analytics/top-skills-by-yoe`
- `GET /api/analytics/market-trends`
- `GET /api/analytics/dashboard-stats`
- `GET /api/analytics/skill-correlation`

### Data

- `GET /api/data/validation-summary`

### Reporting

- `GET /api/report/:resumeId`
- `GET /api/report/:resumeId/pdf`

## Local Setup

### Backend environment variables

- `MONGO_URI`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` optional, default `gemini-2.5-flash`
- `GEMINI_EMBEDDING_MODEL` optional, default `text-embedding-004`
- `GEMINI_EMBEDDING_FALLBACK` optional, default `embedding-001`
- `PORT` optional, default `5000`

### Frontend environment variables

- `VITE_API_BASE_URL` optional

### Commands

Backend:

- `cd backend`
- `npm install`
- `npm run dev`

Frontend:

- `cd frontend`
- `npm install`
- `npm run dev`

## Verification

Backend tests:

- `cd backend`
- `npm test`

Frontend lint:

- `cd frontend`
- `npm run lint`

## Additional Docs

- `TECHNICAL_IMPLEMENTATION.md` for implementation details
- `PROJECT_FUNCTIONALITY.md` for feature-by-feature behavior
- `SYSTEM_EXPLANATION.md` for architecture and flow
- `RESEARCH_METHODOLOGY.md` for the research/data perspective
- `PLAIN_ENGLISH_GUIDE.md` for an easy non-technical explanation
- `algorithms.md` for deeper algorithm notes
