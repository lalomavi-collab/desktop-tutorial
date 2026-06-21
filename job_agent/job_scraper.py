"""
Job scraper — uses requests (no browser required).
Sources: LinkedIn Jobs Guest API, AllJobs.co.il, Indeed RSS, Greenhouse/Lever.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from job_agent.job_scorer import JobListing

DEFAULT_QUERIES = [
    "AI law legal Israel",
    "legal tech counsel Israel remote",
    "AI governance legal Israel",
    "AI law policy director remote",
    "autonomous vehicles legal counsel remote",
    "AI regulation attorney director",
    "LegalTech head of legal",
    "AI ethics officer legal counsel",
]

HEBREW_QUERIES = [
    "יועץ משפטי בינה מלאכותית",
    "דירקטור משפטי טכנולוגיה",
    "משפטן AI רגולציה",
]

MAX_JOBS_PER_QUERY = 5

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
}


def _get(url: str, params: dict | None = None, timeout: int = 15) -> requests.Response | None:
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return r
    except Exception as e:
        print(f"    [warn] {url[:60]} → {e}")
        return None


# ── LinkedIn Guest Jobs API ────────────────────────────────────────────────

def scrape_linkedin(query: str, location: str = "Israel", max_results: int = MAX_JOBS_PER_QUERY) -> list[JobListing]:
    jobs: list[JobListing] = []
    url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    params = {
        "keywords": query,
        "location": location,
        "start": 0,
        "count": max_results,
    }
    r = _get(url, params=params)
    if not r:
        return jobs

    soup = BeautifulSoup(r.text, "html.parser")
    cards = soup.find_all("li")

    for card in cards[:max_results]:
        try:
            title_el = card.find("h3")
            company_el = card.find("h4")
            loc_el = card.find("span", class_=re.compile("job-search-card__location"))
            link_el = card.find("a", href=True)

            if not title_el or not link_el:
                continue

            title = title_el.get_text(strip=True)
            company = company_el.get_text(strip=True) if company_el else ""
            loc = loc_el.get_text(strip=True) if loc_el else location
            href = link_el["href"].split("?")[0]

            jobs.append(JobListing(
                title=title,
                company=company,
                url=href,
                description="",
                location=loc,
            ))
        except Exception:
            continue

    return jobs


# ── AllJobs.co.il ─────────────────────────────────────────────────────────

def scrape_alljobs(query: str, max_results: int = MAX_JOBS_PER_QUERY) -> list[JobListing]:
    jobs: list[JobListing] = []
    url = "https://www.alljobs.co.il/SearchResultsGuest.aspx"
    params = {
        "position": query,
        "type": 0,
    }
    r = _get(url, params=params)
    if not r:
        return jobs

    soup = BeautifulSoup(r.text, "html.parser")
    cards = soup.find_all("div", class_=re.compile("position-item|job-item"))

    for card in cards[:max_results]:
        try:
            title_el = card.find(["h2", "h3", "a"], class_=re.compile("title|position"))
            company_el = card.find(class_=re.compile("company"))
            loc_el = card.find(class_=re.compile("location|city"))
            link_el = card.find("a", href=True)

            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            company = company_el.get_text(strip=True) if company_el else ""
            loc = loc_el.get_text(strip=True) if loc_el else "Israel"
            href = link_el["href"] if link_el else ""
            if href and not href.startswith("http"):
                href = "https://www.alljobs.co.il" + href

            jobs.append(JobListing(
                title=title,
                company=company,
                url=href,
                description="",
                location=loc,
            ))
        except Exception:
            continue

    return jobs


# ── Greenhouse / Lever public boards ──────────────────────────────────────

GREENHOUSE_BOARDS = [
    ("Wiz", "wiz"),
    ("Pagaya", "pagayais"),
    ("monday.com", "mondaydotcom"),
]

LEVER_BOARDS = [
    ("Mobileye", "mobileye"),
]

LEGAL_KEYWORDS = re.compile(
    r"legal|counsel|privacy|compliance|regulatory|gdpr|attorney|lawyer|law",
    re.IGNORECASE,
)


def scrape_greenhouse(company: str, board: str) -> list[JobListing]:
    jobs: list[JobListing] = []
    url = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"
    r = _get(url)
    if not r:
        return jobs
    try:
        data = r.json()
        for job in data.get("jobs", []):
            title = job.get("title", "")
            if not LEGAL_KEYWORDS.search(title):
                continue
            jobs.append(JobListing(
                title=title,
                company=company,
                url=job.get("absolute_url", ""),
                description="",
                location=job.get("location", {}).get("name", ""),
            ))
    except Exception as e:
        print(f"    [warn] greenhouse/{board}: {e}")
    return jobs


def scrape_lever(company: str, board: str) -> list[JobListing]:
    jobs: list[JobListing] = []
    url = f"https://api.lever.co/v0/postings/{board}?mode=json"
    r = _get(url)
    if not r:
        return jobs
    try:
        data = r.json()
        for job in data:
            title = job.get("text", "")
            if not LEGAL_KEYWORDS.search(title):
                continue
            loc = job.get("categories", {}).get("location", "")
            jobs.append(JobListing(
                title=title,
                company=company,
                url=job.get("hostedUrl", ""),
                description=job.get("descriptionPlain", "")[:400],
                location=loc,
            ))
    except Exception as e:
        print(f"    [warn] lever/{board}: {e}")
    return jobs


# ── Main entry point ───────────────────────────────────────────────────────

def scrape_jobs(
    queries: list[str] | None = None,
    sources: list[str] | None = None,
    headless: bool = True,
    max_per_query: int = MAX_JOBS_PER_QUERY,
    israel_focus: bool = True,
) -> list[JobListing]:
    if queries is None:
        queries = DEFAULT_QUERIES
    if sources is None:
        sources = ["linkedin", "alljobs", "greenhouse", "lever"]

    all_jobs: list[JobListing] = []
    seen: set[str] = set()

    # LinkedIn — English queries, Israel
    if "linkedin" in sources:
        for q in queries:
            print(f"  LinkedIn: \"{q}\"")
            jobs = scrape_linkedin(q, location="Israel", max_results=max_per_query)
            print(f"    → {len(jobs)} results")
            all_jobs.extend(jobs)
            time.sleep(1.5)

    # AllJobs — Hebrew queries
    if "alljobs" in sources:
        for q in HEBREW_QUERIES:
            print(f"  AllJobs: \"{q}\"")
            jobs = scrape_alljobs(q, max_results=max_per_query)
            print(f"    → {len(jobs)} results")
            all_jobs.extend(jobs)
            time.sleep(1)

    # Greenhouse boards
    if "greenhouse" in sources:
        for company, board in GREENHOUSE_BOARDS:
            print(f"  Greenhouse: {company}")
            jobs = scrape_greenhouse(company, board)
            print(f"    → {len(jobs)} legal roles")
            all_jobs.extend(jobs)
            time.sleep(0.5)

    # Lever boards
    if "lever" in sources:
        for company, board in LEVER_BOARDS:
            print(f"  Lever: {company}")
            jobs = scrape_lever(company, board)
            print(f"    → {len(jobs)} legal roles")
            all_jobs.extend(jobs)
            time.sleep(0.5)

    # Deduplicate by title+company
    unique: list[JobListing] = []
    for job in all_jobs:
        key = f"{job.title.lower()}|{job.company.lower()}"
        if key not in seen and job.title and job.company:
            seen.add(key)
            unique.append(job)

    return unique


def run_scrape(
    queries: list[str] | None = None,
    sources: list[str] | None = None,
    headless: bool = True,
    max_per_query: int = MAX_JOBS_PER_QUERY,
    israel_focus: bool = True,
) -> list[JobListing]:
    return scrape_jobs(queries, sources, headless, max_per_query, israel_focus)
