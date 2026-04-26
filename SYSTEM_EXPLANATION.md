# CareerAlign - System Explanation (Presentation-Friendly)

CareerAlign is a resume intelligence system built as a **single evidence-backed pipeline**:

**parse → extract → score → prioritize → recommend → justify → report**

The project is intentionally designed to keep key decisions **explainable and reproducible**, using AI only where it is strongest (PDF parsing + optional semantic embeddings).

## What the user sees
- **Landing page** (`/`): overview + entry points
- **Dashboard** (`/dashboard`): resume upload + JD analysis + roadmap + job suggestions + report access
- **Resume-only recommendations** (`/resume-recommendations`): benchmark role ranking without a job description
- **Market intelligence** (`/analytics`): global benchmark analytics, or candidate analytics when `resumeId` is present
- **Research report** (`/report/:resumeId`): unified report + PDF export

## System architecture (high level)
```
React (Vite) frontend
  ↓ REST API
Express backend (Node.js)
  ↓
MongoDB (resumes + skill facts)    Processed artifacts on disk (job postings, skill facts, course catalog, validation summary)
  ↓
Gemini (PDF parsing + optional embeddings; JD extraction fallback)
```

## How the pipeline works (end-to-end)

### 1) Resume parsing (PDF → structured evidence)
1. User uploads a PDF resume
2. Backend sends the PDF to Gemini with a strict JSON schema prompt
3. Backend normalizes and validates fields (especially array fields)
4. The `Resume` document is stored in MongoDB under `extracted`

### 2) Job requirement extraction (JD → canonical skills + role cues)
1. Deterministic extractor searches for canonical skills and title candidates using benchmark-known skills and aliases
2. A confidence score is computed
3. Gemini is used **only if confidence is low** (fallback extraction)

### 3) Explainable scoring (`hybrid-v2`)
Fit is computed from five components (with baselines preserved for comparison):

\[
final\_score = 0.35 \cdot exact\_skill\_coverage + 0.20 \cdot skill\_level\_fit + 0.20 \cdot semantic\_similarity + 0.15 \cdot experience\_alignment + 0.10 \cdot role\_cooccurrence\_fit
\]

Where:
- **Exact skill coverage**: canonical overlap between resume and target skills
- **Skill-level fit**: experience-aware maturity fit backed by benchmark expectations
- **Semantic similarity**: embeddings when available, lexical fallback otherwise
- **Experience alignment**: fit between estimated resume years and target YOE range
- **Role co-occurrence fit**: how strongly the candidate’s skill bundle matches benchmark bundles

### 4) Missing-skill priority ranking + roadmap (`roadmap-v2`)
1. Missing skills are ranked by:
   - target role need (benchmark role profiles)
   - market demand (global + experience-band demand)
   - candidate readiness (prereqs + adjacent skills)
   - effort inverse (time-to-impact)
2. The roadmap selects learning options from a curated, normalized course catalog and ranks them deterministically.
3. Every selected item returns “selected because” reasoning so the roadmap is interpretable.

### 5) Market intelligence (global + candidate)
The analytics page exists to justify roadmap decisions:

- **Global insights** (no resume required): what the benchmark market values overall
- **User insights** (resume required): why the focus skill matters now, what bundles with it, and how role fit improves if it’s closed (role-lift simulation)

### 6) Research report + PDF
The report aggregates:
- resume snapshot
- job match results + methodology metadata
- resume quality evidence
- roadmap + priority ranking evidence
- market evidence and top role matches
- dataset validation snapshot + dataset version

## What is AI vs deterministic

### AI is used for
- PDF resume parsing
- semantic embeddings (when available)
- JD extraction fallback when deterministic confidence is low

### Deterministic logic is used for
- hybrid scoring assembly + baselines
- missing-skill priority ranking
- roadmap selection and ordering
- analytics computations and simulations

This division is the main reason the system can justify *why* it recommends a skill, not only *what* it recommends.
