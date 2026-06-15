# /upskill — Skill Gap Analysis

Analyze the gap between Dr. Lalum's current profile and top-scoring job postings.

## Steps

1. Read `job_agent/applications/tracker.csv` — look at the top 5-10 scored jobs.
   If tracker is empty, read `job_agent/logs/application_log.jsonl` instead.

2. Read `job_agent/profile/01-candidate-profile.md` for current skills.

3. For each top job, extract: required skills, preferred qualifications, tools, certifications mentioned.

4. Compare against the profile. Identify gaps in 3 categories:
   - **Critical gaps** — frequently required, completely absent from profile
   - **Partial gaps** — mentioned in profile but at lower depth than required
   - **Emerging signals** — appearing in 2+ job postings but not yet standard

5. Produce a **skill gap heatmap** (markdown table):
   | Skill | Frequency in jobs | Current level | Gap | Learning priority |
   |-------|-------------------|---------------|-----|-------------------|

6. For top 3 gaps, suggest a **learning plan**:
   - Specific resource (course, book, certification)
   - Estimated time
   - How it strengthens the application narrative

## Usage
- `/upskill` — analyze against all tracked jobs
- `/upskill <URL>` — analyze gap for a specific job posting
