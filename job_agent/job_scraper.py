"""
סורק משרות אמיתי — LinkedIn + Indeed + Greenhouse/Lever דרך Playwright.
מחזיר רשימת JobListing מוכנה לציון.
"""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import quote_plus

from playwright.async_api import async_playwright, Page, Browser

from job_agent.job_scorer import JobListing

# מילות חיפוש ממוקדות לפרופיל ד"ר לאלום
# מילות חיפוש ממוקדות — AI+משפט, ישראל ובינלאומי עם נוכחות ישראלית
DEFAULT_QUERIES = [
    # ישראל ספציפי
    "AI law legal Israel",
    "legal tech counsel Israel remote",
    "AI governance legal Israel",
    # בינלאומי — רלוונטי לפרופיל
    "AI law policy director remote",
    "autonomous vehicles legal counsel remote",
    "AI regulation attorney director",
    "LegalTech head of legal",
    "AI ethics officer legal counsel",
]

# שאילתות בעברית לאתרים ישראליים
HEBREW_QUERIES = [
    "יועץ משפטי בינה מלאכותית",
    "דירקטור משפטי טכנולוגיה",
    "משפטן AI רגולציה",
    "ראש מחלקה משפטית טכנולוגיה",
]

ISRAEL_LOCATIONS = ["Israel", "Tel Aviv", "ישראל"]
GLOBAL_LOCATIONS = ["Remote", "United States", "Europe"]

MAX_JOBS_PER_QUERY = 5


async def _scroll_and_wait(page: Page, times: int = 3) -> None:
    for _ in range(times):
        await page.evaluate("window.scrollBy(0, 600)")
        await asyncio.sleep(0.8)


# ── LinkedIn ───────────────────────────────────────────────────────────────

async def scrape_linkedin(
    page: Page,
    query: str,
    location: str = "Remote",
    max_results: int = MAX_JOBS_PER_QUERY,
) -> list[JobListing]:
    """סורק LinkedIn Jobs ומחזיר רשימת משרות."""
    url = (
        f"https://www.linkedin.com/jobs/search/"
        f"?keywords={quote_plus(query)}"
        f"&location={quote_plus(location)}"
        f"&f_WT=2"         # Remote filter
        f"&sortBy=R"       # Most relevant
    )

    jobs: list[JobListing] = []
    try:
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        await asyncio.sleep(3)
        await _scroll_and_wait(page)

        # חלץ כרטיסי משרה
        cards = await page.query_selector_all(".jobs-search__results-list li, .job-card-container")
        if not cards:
            cards = await page.query_selector_all("li[data-occludable-job-id]")

        for card in cards[:max_results]:
            try:
                title_el = await card.query_selector(".base-search-card__title, .job-card-list__title")
                company_el = await card.query_selector(".base-search-card__subtitle, .job-card-container__company-name")
                location_el = await card.query_selector(".job-search-card__location, .job-card-container__metadata-item")
                link_el = await card.query_selector("a.base-card__full-link, a.job-card-list__title")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                location_txt = (await location_el.inner_text()).strip() if location_el else ""
                job_url = await link_el.get_attribute("href") if link_el else ""

                if not title or not company:
                    continue

                # נסה לחלץ תיאור מלא
                description = await _get_linkedin_description(page, job_url) if job_url else ""

                jobs.append(JobListing(
                    title=title,
                    company=company,
                    url=job_url or url,
                    description=description or f"{title} at {company}. {location_txt}",
                    location=location_txt,
                    salary="",
                ))
            except Exception:
                continue

    except Exception as e:
        print(f"  [LinkedIn] שגיאה בשאילתה '{query}': {e}")

    return jobs


async def _get_linkedin_description(page: Page, job_url: str) -> str:
    """פותח עמוד משרה ב-LinkedIn וחולץ את התיאור."""
    try:
        detail_page = await page.context.new_page()
        await detail_page.goto(job_url, timeout=20000, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        desc_el = await detail_page.query_selector(".description__text, .show-more-less-html__markup")
        desc = (await desc_el.inner_text()).strip() if desc_el else ""
        await detail_page.close()
        return desc[:1500]
    except Exception:
        return ""


# ── Indeed ─────────────────────────────────────────────────────────────────

async def scrape_indeed(
    page: Page,
    query: str,
    location: str = "Remote",
    max_results: int = MAX_JOBS_PER_QUERY,
) -> list[JobListing]:
    """סורק Indeed ומחזיר רשימת משרות."""
    url = (
        f"https://www.indeed.com/jobs"
        f"?q={quote_plus(query)}"
        f"&l={quote_plus(location)}"
        f"&remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11"
    )

    jobs: list[JobListing] = []
    try:
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        await asyncio.sleep(3)
        await _scroll_and_wait(page)

        cards = await page.query_selector_all("div.job_seen_beacon, .resultContent")

        for card in cards[:max_results]:
            try:
                title_el = await card.query_selector("h2.jobTitle span, .jobTitle a")
                company_el = await card.query_selector("[data-testid='company-name'], .companyName")
                location_el = await card.query_selector("[data-testid='text-location'], .companyLocation")
                salary_el = await card.query_selector("[data-testid='attribute_snippet_testid'], .salary-snippet")
                link_el = await card.query_selector("h2.jobTitle a, a.jcs-JobTitle")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                location_txt = (await location_el.inner_text()).strip() if location_el else ""
                salary = (await salary_el.inner_text()).strip() if salary_el else ""
                href = await link_el.get_attribute("href") if link_el else ""
                job_url = f"https://www.indeed.com{href}" if href and href.startswith("/") else href

                if not title or not company:
                    continue

                # תיאור מקוצר מהכרטיס
                desc_el = await card.query_selector(".job-snippet, ul.css-9446ny")
                description = (await desc_el.inner_text()).strip() if desc_el else f"{title} at {company}"

                jobs.append(JobListing(
                    title=title,
                    company=company,
                    url=job_url or url,
                    description=description,
                    location=location_txt,
                    salary=salary,
                ))
            except Exception:
                continue

    except Exception as e:
        print(f"  [Indeed] שגיאה בשאילתה '{query}': {e}")

    return jobs


# ── Google Jobs ────────────────────────────────────────────────────────────

async def scrape_google_jobs(
    page: Page,
    query: str,
    max_results: int = MAX_JOBS_PER_QUERY,
) -> list[JobListing]:
    """חיפוש דרך Google Jobs (htmx)."""
    url = f"https://www.google.com/search?q={quote_plus(query + ' jobs')}&ibp=htl;jobs"

    jobs: list[JobListing] = []
    try:
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        await asyncio.sleep(3)

        cards = await page.query_selector_all('[data-ved] li.iFjolb, .pE8vnd')

        for card in cards[:max_results]:
            try:
                title_el = await card.query_selector(".BjJfJf, [class*='title']")
                company_el = await card.query_selector(".vNEEBe, [class*='company']")
                location_el = await card.query_selector(".Qk80Jf, [class*='location']")
                salary_el = await card.query_selector(".SuWscb, [class*='salary']")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                location_txt = (await location_el.inner_text()).strip() if location_el else ""
                salary = (await salary_el.inner_text()).strip() if salary_el else ""

                if not title or not company:
                    continue

                # לחץ לפתיחת פרטים
                await card.click()
                await asyncio.sleep(1.5)
                desc_el = await page.query_selector(".HBvzbc, [class*='description']")
                desc = (await desc_el.inner_text()).strip() if desc_el else ""
                link_el = await page.query_selector("a[data-url], .pMhGee a")
                job_url = await link_el.get_attribute("href") if link_el else url
                if job_url and job_url.startswith("//"):
                    job_url = "https:" + job_url

                jobs.append(JobListing(
                    title=title,
                    company=company,
                    url=job_url or url,
                    description=desc[:1500] if desc else f"{title} at {company}",
                    location=location_txt,
                    salary=salary,
                ))
            except Exception:
                continue

    except Exception as e:
        print(f"  [Google Jobs] שגיאה בשאילתה '{query}': {e}")

    return jobs


# ── AllJobs (ישראל) ────────────────────────────────────────────────────────

async def scrape_alljobs(
    page: Page,
    query: str,
    max_results: int = MAX_JOBS_PER_QUERY,
) -> list[JobListing]:
    """סורק AllJobs.co.il — האתר המוביל בישראל."""
    url = f"https://www.alljobs.co.il/SearchResultsGuest.aspx?position={quote_plus(query)}&type=1"

    jobs: list[JobListing] = []
    try:
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        await asyncio.sleep(3)
        await _scroll_and_wait(page)

        cards = await page.query_selector_all(".job-content, .single-job, [class*='job-item']")

        for card in cards[:max_results]:
            try:
                title_el = await card.query_selector("h2, h3, .job-title, [class*='title']")
                company_el = await card.query_selector(".company-name, [class*='company']")
                location_el = await card.query_selector(".job-location, [class*='location'], [class*='city']")
                link_el = await card.query_selector("a")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                location_txt = (await location_el.inner_text()).strip() if location_el else "Israel"
                href = await link_el.get_attribute("href") if link_el else ""
                job_url = f"https://www.alljobs.co.il{href}" if href and href.startswith("/") else href

                if not title:
                    continue

                desc_el = await card.query_selector(".job-description, [class*='desc'], p")
                description = (await desc_el.inner_text()).strip() if desc_el else f"{title} at {company or 'Israeli company'}"

                jobs.append(JobListing(
                    title=title,
                    company=company or "Israeli company",
                    url=job_url or url,
                    description=description,
                    location=location_txt,
                    salary="",
                ))
            except Exception:
                continue

    except Exception as e:
        print(f"  [AllJobs] שגיאה בשאילתה '{query}': {e}")

    return jobs


async def scrape_drushim(
    page: Page,
    query: str,
    max_results: int = MAX_JOBS_PER_QUERY,
) -> list[JobListing]:
    """סורק Drushim.co.il."""
    url = f"https://www.drushim.co.il/jobs/q-{quote_plus(query)}/"

    jobs: list[JobListing] = []
    try:
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        await asyncio.sleep(3)
        await _scroll_and_wait(page)

        cards = await page.query_selector_all(".job-item, article.job, [class*='job-card']")

        for card in cards[:max_results]:
            try:
                title_el = await card.query_selector("h2, h3, .job-title")
                company_el = await card.query_selector(".company, [class*='company']")
                location_el = await card.query_selector(".location, [class*='location']")
                link_el = await card.query_selector("a")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                location_txt = (await location_el.inner_text()).strip() if location_el else "Israel"
                href = await link_el.get_attribute("href") if link_el else ""
                job_url = f"https://www.drushim.co.il{href}" if href and href.startswith("/") else href

                if not title:
                    continue

                jobs.append(JobListing(
                    title=title,
                    company=company or "Israeli company",
                    url=job_url or url,
                    description=f"{title} at {company}. Location: {location_txt}",
                    location=location_txt,
                    salary="",
                ))
            except Exception:
                continue

    except Exception as e:
        print(f"  [Drushim] שגיאה בשאילתה '{query}': {e}")

    return jobs


async def scrape_linkedin_israel(
    page: Page,
    query: str,
    max_results: int = MAX_JOBS_PER_QUERY,
) -> list[JobListing]:
    """LinkedIn ממוקד ישראל — geoId=101620260."""
    url = (
        f"https://www.linkedin.com/jobs/search/"
        f"?keywords={quote_plus(query)}"
        f"&location=Israel"
        f"&geoId=101620260"
        f"&sortBy=R"
    )
    return await scrape_linkedin(page, query, location="Israel", max_results=max_results)


# ── Main scraper ───────────────────────────────────────────────────────────

async def scrape_jobs(
    queries: list[str] | None = None,
    sources: list[str] | None = None,
    headless: bool = True,
    max_per_query: int = MAX_JOBS_PER_QUERY,
    israel_focus: bool = True,
) -> list[JobListing]:
    """
    מריץ סריקה מלאה על כל המקורות והשאילתות.
    israel_focus=True: מחפש קודם בפורטלים ישראלים + LinkedIn Israel.
    מחזיר רשימה מאוחדת ללא כפילויות.
    """
    if queries is None:
        queries = DEFAULT_QUERIES
    if sources is None:
        sources = ["alljobs", "linkedin_israel", "linkedin", "indeed"] if israel_focus else ["linkedin", "indeed"]

    all_jobs: list[JobListing] = []
    seen_titles: set[str] = set()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="he-IL",
        )

        page = await context.new_page()

        # שלב 1: אתרים ישראליים עם שאילתות עבריות
        if "alljobs" in sources:
            for q in HEBREW_QUERIES:
                print(f"\n  AllJobs: \"{q}\"")
                jobs = await scrape_alljobs(page, q, max_results=max_per_query)
                print(f"    → {len(jobs)} תוצאות")
                all_jobs.extend(jobs)
                await asyncio.sleep(2)

        if "drushim" in sources:
            for q in HEBREW_QUERIES:
                print(f"\n  Drushim: \"{q}\"")
                jobs = await scrape_drushim(page, q, max_results=max_per_query)
                print(f"    → {len(jobs)} תוצאות")
                all_jobs.extend(jobs)
                await asyncio.sleep(2)

        # שלב 2: LinkedIn ישראל + בינלאומי
        for query in queries:
            print(f"\n  חיפוש: \"{query}\"")

            if "linkedin_israel" in sources:
                jobs = await scrape_linkedin_israel(page, query, max_results=max_per_query)
                print(f"    LinkedIn Israel → {len(jobs)} תוצאות")
                all_jobs.extend(jobs)

            if "linkedin" in sources and "linkedin_israel" not in sources:
                jobs = await scrape_linkedin(page, query, max_results=max_per_query)
                print(f"    LinkedIn → {len(jobs)} תוצאות")
                all_jobs.extend(jobs)

            if "indeed" in sources:
                jobs = await scrape_indeed(page, query, max_results=max_per_query)
                print(f"    Indeed  → {len(jobs)} תוצאות")
                all_jobs.extend(jobs)

            if "google" in sources:
                jobs = await scrape_google_jobs(page, query, max_results=max_per_query)
                print(f"    Google  → {len(jobs)} תוצאות")
                all_jobs.extend(jobs)

            await asyncio.sleep(2)

        await browser.close()

    # הסר כפילויות לפי כותרת+חברה
    unique: list[JobListing] = []
    for job in all_jobs:
        key = f"{job.title.lower()}|{job.company.lower()}"
        if key not in seen_titles and job.title and job.company:
            seen_titles.add(key)
            unique.append(job)

    return unique


def run_scrape(
    queries: list[str] | None = None,
    sources: list[str] | None = None,
    headless: bool = True,
    max_per_query: int = MAX_JOBS_PER_QUERY,
    israel_focus: bool = True,
) -> list[JobListing]:
    """גרסה סינכרונית להפעלה מ-CLI."""
    return asyncio.run(scrape_jobs(queries, sources, headless, max_per_query, israel_focus))
