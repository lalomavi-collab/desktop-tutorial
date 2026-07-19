# /apply — Full Job Application Workflow

Run the complete drafter-reviewer application pipeline for a job posting.

Usage:
- `/apply <URL>` — fetch and apply to a job by URL
- `/apply` (then paste job description) — apply from pasted text

## Workflow

### Step 1: Parse
Read the job posting. Extract: title, company, location, salary, requirements, responsibilities, culture signals.

### Step 2: Evaluate
Read `job_agent/profile/04-job-evaluation.md`. Score the job 1–10 for Dr. Lalum.
If score < 7: report the score and reason, ask whether to continue anyway.

### Step 3: Draft (Drafter Agent)
Read all profile files:
- `job_agent/profile/01-candidate-profile.md`
- `job_agent/profile/02-behavioral-profile.md`
- `job_agent/profile/03-writing-style.md`
- `job_agent/profile/04-job-evaluation.md`

Produce:
1. **Tailored cover letter** (exactly 1 page when printed; follow style guide from 03)
   - Hook: connect Dr. Lalum's specific expertise to the company's AI/legal challenge
   - Fit: match top credentials to job requirements
   - Value: unique combination (PhD + 20 years practice + AI research + policy leadership)
   - Closing: express interest, request conversation

2. **CV highlights** (3-5 bullet points most relevant to this specific role, reordered per 03's tailoring rules)

### Step 4: Review (Reviewer Agent)
Spawn a second agent with fresh context. Give it: the job posting + the drafts.
Reviewer tasks:
- Research the company (use WebSearch if available): recent AI news, regulatory challenges, culture
- Check: are all claims in the cover letter verifiable from the profile? Flag any fabrications.
- Check: does the cover letter avoid generic phrases (see 03-writing-style.md don'ts)?
- Check: is the hook specific to THIS company, not generic?
- Suggest 2-3 concrete improvements

### Step 5: Revise
Apply the reviewer's feedback. Present final cover letter.

### Step 6: Log
Append to `job_agent/applications/tracker.csv`:
```
date, company, title, url, score, status, cover_letter_file
```
Save cover letter as `job_agent/applications/YYYY-MM-DD_<Company>_<Role>.md`

### Step 7: Present
Show the final cover letter and CV bullets.
Offer: "Apply now with Playwright? (y/n)"
If y: run `python job_agent/browser_apply.py` with the URL.
