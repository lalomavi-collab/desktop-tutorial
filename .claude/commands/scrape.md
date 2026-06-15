# /scrape — Live Job Search

Search LinkedIn, Indeed, and Google Jobs for positions matching Dr. Lalum's profile.

## Steps

1. Read `job_agent/profile/04-job-evaluation.md` for scoring criteria and keyword signals.

2. Run the scraper:
```bash
python -m job_agent.main --scrape --resume job_agent/resume.docx --min-score 7 --headed
```

Or for headless (no browser window):
```bash
python -m job_agent.main --scrape --resume job_agent/resume.docx --min-score 7
```

3. Present results sorted by score. For each job above threshold, show:
   - Title, company, location, salary
   - Score and reason
   - URL

4. For each result ask: "Apply? (y=full /apply flow / n=skip / d=details)"
   - `y` → run `/apply <URL>` workflow
   - `n` → skip, log as "skipped"
   - `d` → show full description, then ask again

5. After session: show summary table of all decisions made.

## Custom queries
To override default search queries:
```bash
python -m job_agent.main --scrape --queries "AI law policy,legal tech director,autonomous systems counsel" --headed
```

## Tip
Run with `--headed` the first time to watch the browser and verify it's finding relevant jobs.
After confirming it works, use headless for faster runs.
