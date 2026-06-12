# /expand — Enrich Profile from Public Sources

Scan Dr. Lalum's public online presence to discover credentials and competencies not captured in the profile files.

## Sources to check

1. **ORCID** — https://orcid.org/0000-0001-6094-5303
   - Fetch full publication list
   - Add any papers not listed in 01-candidate-profile.md

2. **Website** — https://www.lalum.co
   - Scan for: additional publications, courses, media appearances, keynotes
   - Look for: blog posts, position papers, or expert opinions

3. **LinkedIn** — https://www.linkedin.com/in/avraham-lalum
   - Check for recent activity, endorsements, recommendations

4. **Google Scholar** — search "Avraham Lalum" or "Avi Lalum"
   - Citation counts
   - Additional papers or book chapters

## What to update

After scanning, update `job_agent/profile/01-candidate-profile.md` with:
- Any new publications found (with source tag)
- Any speaking engagements, media quotes, or expert appearances
- Citation counts from Google Scholar

Report: "Found X new items. Added to profile: [list]"

## Usage
Simply run `/expand` and Claude will search the above sources and update the profile.
