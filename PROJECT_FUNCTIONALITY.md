# CareerAlign - Complete Functionality Documentation (Current System)

This document is the **product + system-level** description of what CareerAlign does today, aligned with the current codebase (backend controllers/utils, frontend screens, and the research datasets).

If you want algorithm-level details, see `algorithms.md`. If you want the shortest “read these files first” path, see `README.md`.

## Product Overview
CareerAlign is a resume intelligence system built around one connected pipeline:

- **Parse** a resume into structured evidence
- **Extract** job requirements from a pasted job description (deterministic first, Gemini fallback when confidence is low)
- **Score** fit with an explainable hybrid model (`hybrid-v2`)
- **Prioritize** missing skills using market + role evidence
- **Recommend** benchmark roles and a deterministic learning roadmap backed by a curated course catalog
- **Justify** the roadmap using contextual market analytics and a research report (web + PDF)

## Core User Workflows

### 1) Resume upload & parsing (PDF → structured profile)
- **User action**: Upload a PDF resume.
- **Backend**: Gemini parses the PDF and returns a strict JSON structure (normalized before saving).
- **Stored**: `Resume` document with `extracted` fields (plus `latestAnalysis`, `latestResumeQuality`, etc. as the user runs analysis).
- **Endpoint**: `POST /api/resume/upload`
- **Primary UI**: `frontend/src/components/Dashboard.jsx` and `frontend/src/components/ResumeRecommendations.jsx`

### 2) Resume vs Job Description analysis (candidate mode)
- **User action**: Paste a job description and click analyze.
- **Backend pipeline**:
  - Extract role title candidates + skills from the JD (`jobRequirementExtractor.js`) using deterministic extraction first.
  - Estimate resume years of experience from extracted experience entries.
  - Compute fit using `hybrid-v2` with component breakdown and baselines.
  - Compute resume writing quality (separate from fit).
  - Compute missing-skill priority ranking (market + role + readiness + effort).
  - Build a deterministic roadmap from a curated course catalog (`roadmap-v2`).
  - Persist results to the resume as `latestAnalysis` / `latestResumeQuality`.
- **Endpoint**: `POST /api/analysis/analyze`
- **Primary UI**: `frontend/src/components/Dashboard.jsx`

### 3) Resume-only benchmark role recommendations (no JD required)
- **User action**: Upload a resume without a job description.
- **Backend behavior**:
  - Uses the same core scoring family against benchmark roles, then adds recommendation signals (title alignment, demand alignment, confidence).
  - Returns ranked benchmark roles with component scores and explanations.
- **Endpoint**: `GET /api/analysis/job-suggestions?resumeId=...&limit=...`
- **Primary UI**: `frontend/src/components/ResumeRecommendations.jsx`

### 4) Roadmap generation (deterministic, catalog-backed)
- **User action**: After analysis, view the roadmap and optionally change the **focus skill**.
- **Backend behavior**:
  - Builds a missing-skill priority ranking.
  - Selects a focus skill (explicit focus, or highest-impact missing skill).
  - Pulls learning options from the normalized course catalog and ranks them deterministically.
  - Groups items into phases and provides “selected because” reasoning.
- **Endpoint**: `POST /api/analysis/roadmap` with `{ resumeId, focusSkill }`
- **Primary UI**: `frontend/src/components/Dashboard.jsx`

### 5) Market intelligence analytics (global mode + candidate mode)
This is not a separate “generic charts page” anymore. It exists to justify roadmap decisions and answer “why this skill, why now, what changes if I learn it?”

- **Global mode** (no resume yet):
  - Summary of benchmark demand: top skills, role families, YOE distribution.
  - Skill spotlight: demand curve, adjacent skills, top roles, learning coverage.
  - **Endpoint**: `GET /api/analytics/global-insights?focusSkill=...`
- **Candidate mode** (resume analyzed):
  - Priority chart aligned to the same priority engine used in the roadmap.
  - Demand timing curve for the focus skill by experience band.
  - Role lift simulation (“what if I learn this skill?”) using the hybrid model components.
  - Maturity diagnostic of required skills (ready now / needs depth / high-impact gap / other gap).
  - Roadmap linkage showing which learning options map to the focus skill.
  - **Endpoint**: `GET /api/analytics/user-insights?resumeId=...&focusSkill=...`
- **Primary UI**: `frontend/src/components/AnalyticsDashboard.jsx`

### 6) Research report (web report + PDF export)
- **User action**: Open the report page after analysis and optionally download PDF.
- **Backend**: Aggregates analysis + quality + roadmap + top roles + validation snapshot into one report object.
- **Endpoints**:
  - `GET /api/report/:resumeId`
  - `GET /api/report/:resumeId/pdf`
- **Primary UI**: `frontend/src/components/ResearchReport.jsx`

## Core Algorithms (High-Level)

### Hybrid job matching (`hybrid-v2`)
Used for both JD matching and benchmark role scoring:

\[
final\_score = 0.35 \cdot exact\_skill\_coverage + 0.20 \cdot skill\_level\_fit + 0.20 \cdot semantic\_similarity + 0.15 \cdot experience\_alignment + 0.10 \cdot role\_cooccurrence\_fit
\]

### Recommendation score (for job suggestions)
Job suggestions use a recommendation score on top of the hybrid baseline:
- Base hybrid fit (above)
- Title alignment to inferred role family
- Demand alignment comparing matched-skill demand vs remaining gap pressure
- Confidence label for interpretation (high / medium / exploratory)

### Roadmap (`roadmap-v2`)
Roadmap items are not free-form AI. They are selected from a normalized course catalog and ranked deterministically using:
- Missing-skill priority (role need + market demand + experience-band demand + readiness + effort inverse)
- Level fit
- Provider trust score
- Hands-on score
- Catalog match / adjacency reinforcement

## Datasets & Data Products
CareerAlign uses raw CSV inputs plus processed artifacts used by matching, analytics, and recommendations.

### Raw inputs
- `backend/data/jobs.csv`
- `backend/data/Online_Courses.csv`

### Processed artifacts (generated)
- `backend/data/processed/job_postings.json`
- `backend/data/processed/skill_facts.json`
- `backend/data/processed/course_catalog.json`
- `backend/data/processed/validation-summary.json`

### Validation summary endpoint
- **Endpoint**: `GET /api/data/validation-summary`
- **Purpose**: exposes dataset version + key cleaning/quality metrics used for reproducibility and reporting.

## Backend API Summary (Current)

### Resume
- `POST /api/resume/upload`

### Analysis
- `POST /api/analysis/analyze`
- `POST /api/analysis/resume-quality`
- `POST /api/analysis/roadmap`
- `GET /api/analysis/job-suggestions?resumeId=...&limit=...`

### Analytics
- `GET /api/analytics/global-insights?focusSkill=...`
- `GET /api/analytics/user-insights?resumeId=...&focusSkill=...`

Legacy / aggregation endpoints (still available):
- `GET /api/analytics/top-skills?limit=...`
- `GET /api/analytics/skills-by-yoe`
- `GET /api/analytics/skills-by-title/:title`
- `GET /api/analytics/job-titles`
- `GET /api/analytics/yoe-distribution`
- `GET /api/analytics/top-skills-by-yoe?yoe=...`
- `GET /api/analytics/market-trends?skill=...`
- `GET /api/analytics/dashboard-stats`
- `GET /api/analytics/skill-correlation?skill=...`

### Data
- `GET /api/data/validation-summary`

### Reporting
- `GET /api/report/:resumeId`
- `GET /api/report/:resumeId/pdf`

## Frontend Screens (Current)
- `LandingPage` (`/`)
- `Dashboard` (`/dashboard`): candidate workspace (upload + JD + analysis + roadmap + report link + focus skill selection)
- `ResumeRecommendations` (`/resume-recommendations`): resume-only benchmark role ranking
- `AnalyticsDashboard` (`/analytics`): global or candidate mode depending on `resumeId` query param
- `ResearchReport` (`/report/:resumeId`): full report + PDF export

## AI Usage (What is AI vs deterministic)

### Gemini is used for
- PDF resume parsing (multimodal)
- Job-description extraction **only as a fallback** when deterministic extraction confidence is low
- Semantic embeddings (when enabled/available); lexical fallback exists

### Gemini is not used for
- Roadmap ordering and selection logic
- Missing-skill priority ranking
- Market analytics calculations
- Role-lift simulation math

## Local verification
- Backend tests: `cd backend && npm test`
- Frontend lint: `cd frontend && npm run lint`

