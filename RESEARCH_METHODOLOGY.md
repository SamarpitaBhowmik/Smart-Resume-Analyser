# CareerAlign Research Methodology

## Project Positioning
CareerAlign is now structured as a research-backed decision-support system instead of a dashboard-only prototype.
The system combines:

- hybrid explainable job matching
- resume quality scoring
- market-backed missing-skill analysis
- reproducible dataset validation and reporting

## Dataset Architecture
The project uses two linked datasets generated from the same source file:

1. `job_postings`
   - one row per benchmark role profile
   - stores title, normalized title, description, experience text, normalized YOE ranges, and parsed skills
2. `skill_facts`
   - one row per `(job_id, skill)` pair
   - powers aggregation, heatmaps, demand curves, and correlation analysis

A canonical `skill_alias_map` is used to normalize synonyms such as `JS -> javascript` and `ReactJS -> react`.

## Data Validation Pipeline
The validation pipeline performs:

- required-field checks
- YOE normalization
- title normalization
- skill normalization
- duplicate-row removal
- artifact generation for reproducibility

Generated artifacts:

- `backend/data/processed/job_postings.json`
- `backend/data/processed/skill_facts.json`
- `backend/data/processed/validation-summary.json`

Current processed output from the local dataset:

- `984` benchmark job postings
- `12,247` normalized skill facts
- `92.13%` row retention after cleaning

## Hybrid Matching Formula
Job recommendation and JD analysis use the same explainable scoring logic:

`final_score = 0.35 * exact_skill_coverage + 0.20 * skill_level_fit + 0.20 * semantic_similarity + 0.15 * experience_alignment + 0.10 * role_cooccurrence_fit`

### Components
- `exact_skill_coverage`: exact canonical overlap between resume skills and role skills
- `skill_level_fit`: experience-aware maturity fit for required skills using benchmark expectations
- `semantic_similarity`: embedding similarity when available, with lexical fallback
- `experience_alignment`: fit between estimated resume experience and normalized role YOE range
- `role_cooccurrence_fit`: whether the candidate’s skill bundle resembles benchmark role bundles

### Baselines Preserved
For research comparison and ablation:

- exact-overlap-only baseline
- embeddings-only baseline

## Course Catalog Dataset (Roadmap Evidence)
Roadmap generation is backed by a normalized learning catalog prepared from `Online_Courses.csv` plus curated fallback entries:

- `backend/data/processed/course_catalog.json`

The dataset pipeline validates URLs, normalizes course metadata, infers skills when the raw dataset leaves skill fields blank, and produces summary quality metrics.

## Resume Quality Scoring
Resume quality is intentionally kept separate from job-fit score.

`resume_quality = 0.30 * action_verb_strength + 0.40 * measurable_impact + 0.30 * clarity_specificity`

Each statement is scored independently, then aggregated into:

- overall score
- confidence label
- category scores
- flagged weak statements
- rewrite suggestions

## Report Generation
The report layer uses one shared data model for:

- dashboard preview
- full web report
- PDF export

Each report includes:

- parsed resume summary
- JD match results
- resume quality evidence
- top job recommendations
- missing-skill demand evidence
- methodology summary
- dataset validation snapshot
- reproducibility metadata

## Research-Facing Endpoints
- `POST /api/analysis/analyze`
- `POST /api/analysis/resume-quality`
- `GET /api/analysis/job-suggestions`
- `GET /api/data/validation-summary`
- `GET /api/report/:resumeId`
- `GET /api/report/:resumeId/pdf`

## Evaluation Hooks
The current implementation supports the following evaluation narrative for a paper:

- dataset cleaning impact before vs after validation
- ablation between exact-only, embeddings-only, and hybrid ranking
- statement-quality comparison between weak and strong resume bullets
- skill-gap prioritization using market demand evidence

## Verification Completed Locally
- backend unit and pipeline checks via `npm test`
- frontend static verification via `npm run lint`

## Remaining Environment Constraint
Frontend production build could not be verified on this machine because the installed Node version is `20.17.0`, while the current Vite setup requires `20.19+`.
