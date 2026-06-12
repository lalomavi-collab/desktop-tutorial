"""
מנוע האוטו-אפליי - Playwright מבצע מילוי טפסים ושליחה.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright, Page, Locator


SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)


async def detect_form_fields(page: Page) -> list[dict]:
    """
    סורק את הדף ומזהה שדות טופס עם ID, label, ו-type שלהם.
    """
    return await page.evaluate("""() => {
        const fields = [];
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(el => {
            const type = el.type || el.tagName.toLowerCase();
            if (['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio'].includes(type)) return;

            // Try to find label
            let label = '';
            if (el.id) {
                const labelEl = document.querySelector(`label[for="${el.id}"]`);
                if (labelEl) label = labelEl.innerText.trim();
            }
            if (!label) {
                label = el.placeholder || el.name || el.getAttribute('aria-label') || '';
            }
            // Walk up to find wrapping label text
            if (!label) {
                let parent = el.parentElement;
                for (let i = 0; i < 3 && parent; i++) {
                    const text = parent.innerText?.split('\\n')[0]?.trim();
                    if (text && text.length < 60) { label = text; break; }
                    parent = parent.parentElement;
                }
            }

            fields.push({
                id: el.id || el.name || `field_${fields.length}`,
                name: el.name || '',
                label: label,
                type: type,
                required: el.required,
                tag: el.tagName.toLowerCase()
            });
        });
        return fields;
    }""")


async def fill_form(
    page: Page,
    field_mapping: dict[str, str],
    resume_path: Path,
    headless: bool = False,
) -> bool:
    """
    ממלא את שדות הטופס לפי המיפוי שסופק.
    מחזיר True אם הצליח, False אחרת.
    """
    for field_id, value in field_mapping.items():
        if not value:
            continue

        # Build locator - try id first, then name, then label
        locator: Locator | None = None
        try:
            if await page.locator(f"#{field_id}").count() > 0:
                locator = page.locator(f"#{field_id}").first
            elif await page.locator(f"[name='{field_id}']").count() > 0:
                locator = page.locator(f"[name='{field_id}']").first
            else:
                # Try by aria-label or placeholder
                locator = page.get_by_label(field_id, exact=False).first
        except Exception:
            continue

        if locator is None:
            continue

        try:
            field_type = await locator.get_attribute("type") or await locator.evaluate("el => el.tagName.toLowerCase()")

            if value == "__RESUME_FILE__":
                await locator.set_input_files(str(resume_path))
            elif field_type in ("file",):
                await locator.set_input_files(str(resume_path))
            elif await locator.evaluate("el => el.tagName.toLowerCase()") == "select":
                await locator.select_option(label=value)
            else:
                await locator.fill(value)

            await asyncio.sleep(0.3)  # human-like pacing
        except Exception as e:
            print(f"  [warn] Could not fill field '{field_id}': {e}")

    return True


async def submit_form(page: Page) -> bool:
    """לוחץ על כפתור ה-Submit."""
    submit_selectors = [
        "button[type='submit']",
        "input[type='submit']",
        "button:has-text('Submit')",
        "button:has-text('Apply')",
        "button:has-text('Send Application')",
        "[data-testid='submit']",
    ]
    for sel in submit_selectors:
        try:
            btn = page.locator(sel).first
            if await btn.count() > 0:
                await btn.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                return True
        except Exception:
            continue
    return False


async def take_confirmation_screenshot(page: Page, job_title: str, company: str) -> Path:
    """שומר צילום מסך של דף האישור."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{company}_{job_title}".replace(" ", "_").replace("/", "-")[:50]
    screenshot_path = SCREENSHOTS_DIR / f"{timestamp}_{safe_name}.png"
    await page.screenshot(path=str(screenshot_path), full_page=True)
    return screenshot_path


async def auto_apply(
    job_url: str,
    field_mapping: dict[str, str],
    resume_path: Path,
    job_title: str,
    company: str,
    headless: bool = False,
) -> dict:
    """
    מבצע את תהליך המילוי המלא:
    1. פותח דפדפן
    2. ניווט לURL
    3. זיהוי שדות
    4. מילוי
    5. שליחה
    6. צילום מסך
    """
    result = {
        "success": False,
        "screenshot": None,
        "error": None,
        "fields_detected": 0,
        "fields_filled": 0,
    }

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        try:
            print(f"  [browser] Navigating to: {job_url}")
            await page.goto(job_url, timeout=30000)
            await page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(2)

            fields = await detect_form_fields(page)
            result["fields_detected"] = len(fields)
            print(f"  [browser] Detected {len(fields)} form fields")

            filled = await fill_form(page, field_mapping, resume_path, headless)
            result["fields_filled"] = sum(1 for v in field_mapping.values() if v and v != "__RESUME_FILE__")

            await asyncio.sleep(1)

            submitted = await submit_form(page)
            if not submitted:
                result["error"] = "Could not find submit button"
                screenshot_path = await take_confirmation_screenshot(page, job_title, company)
                result["screenshot"] = str(screenshot_path)
                return result

            await asyncio.sleep(3)
            screenshot_path = await take_confirmation_screenshot(page, job_title, company)
            result["screenshot"] = str(screenshot_path)
            result["success"] = True

        except Exception as e:
            result["error"] = str(e)
            try:
                screenshot_path = await take_confirmation_screenshot(page, job_title, company)
                result["screenshot"] = str(screenshot_path)
            except Exception:
                pass
        finally:
            await browser.close()

    return result


def run_auto_apply(
    job_url: str,
    field_mapping: dict[str, str],
    resume_path: Path,
    job_title: str,
    company: str,
    headless: bool = False,
) -> dict:
    """גרסה סינכרונית להפעלה מה-CLI."""
    return asyncio.run(auto_apply(
        job_url=job_url,
        field_mapping=field_mapping,
        resume_path=resume_path,
        job_title=job_title,
        company=company,
        headless=headless,
    ))
