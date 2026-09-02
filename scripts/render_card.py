#!/usr/bin/env python3
"""Render one 1200x630 social card from HTML to a PNG, using the Chromium that
ships with the environment. No Playwright, no npm install: just the browser's
own headless screenshot.

  python3 scripts/render_card.py posts/images/015_x_en.html lalum-app/public/og/015_x_en.png

The publish pipeline (scripts/publish_post.py) reads cards from
lalum-app/public/og/<num>_<slug>_<lang>.png, so render straight into that path.

Note on fonts: the card CSS pulls Frank Ruhl Libre and Heebo from Google Fonts.
If the render host has no network to fonts.gstatic.com, the browser falls back
to the stacks named in the CSS (David/Georgia, Arial), which still render Hebrew
and Latin correctly, only with slightly different letterforms. For pixel-exact
brand cards, render where the fonts are reachable, or embed them as data URIs.
"""

import subprocess
import sys
from pathlib import Path


def find_chrome() -> str:
    for base in ("/opt/pw-browsers",):
        for exe in Path(base).glob("chromium-*/chrome-linux/chrome"):
            return str(exe)
    # Fall back to anything on PATH.
    for name in ("chromium", "chromium-browser", "google-chrome"):
        p = subprocess.run(["which", name], capture_output=True, text=True)
        if p.returncode == 0 and p.stdout.strip():
            return p.stdout.strip()
    sys.exit("no Chromium found (looked under /opt/pw-browsers and on PATH)")


def render(html_path: str, png_path: str, width: int = 1200, height: int = 630) -> None:
    html = Path(html_path).resolve()
    if not html.exists():
        sys.exit(f"input HTML not found: {html}")
    out = Path(png_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    chrome = find_chrome()
    cmd = [
        chrome, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={width},{height}",
        # Give remote fonts a moment to load before the shot is taken.
        "--virtual-time-budget=2500",
        f"--screenshot={out}", html.as_uri(),
    ]
    # Chromium prints font/SSL noise to stderr even on success, so judge by the
    # file, not the return code.
    subprocess.run(cmd, capture_output=True, text=True)
    if not out.exists() or out.stat().st_size == 0:
        sys.exit(f"render produced no output at {out}")
    print(f"rendered {out.relative_to(Path.cwd())} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: render_card.py <input.html> <output.png>")
    render(sys.argv[1], sys.argv[2])
