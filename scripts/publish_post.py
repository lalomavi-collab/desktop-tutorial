#!/usr/bin/env python3
"""Publish one campaign post to LinkedIn (English) and Facebook (Hebrew).

The post text lives in posts/campaign_sept_2026.json, not in the workflow YAML.
An earlier workflow embedded the text inside a shell heredoc inside YAML, which
meant every quote, apostrophe and emoji was one escaping mistake away from
either failing the run or publishing mangled copy. Reading JSON removes that
whole class of problem, and it keeps a single source of truth: edit the drafts,
regenerate the JSON, and every workflow picks up the change.

Usage:  python3 scripts/publish_post.py 010

Environment:
  ZAPIER_LINKEDIN  webhook that posts to LinkedIn.  English text.
  ZAPIER_FACEBOOK  webhook that posts to Facebook.  Hebrew text.

A missing webhook is reported and skipped rather than crashing, so one
unconfigured platform never silently blocks the other. The run still exits
non-zero if nothing at all was delivered, because a green run that published
nothing is the worst outcome of the three.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "posts" / "campaign_sept_2026.json"
CARD_BASE = "https://lalumapp.com/og"


def send(hook: str, payload: dict, label: str) -> bool:
    req = urllib.request.Request(
        hook,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[{label}] {resp.status} {resp.read().decode()[:300]}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[{label}] FAILED {e.code}: {e.read().decode()[:300]}")
    except Exception as e:  # network, DNS, timeout
        print(f"[{label}] FAILED: {e}")
    return False


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: publish_post.py <post number, e.g. 010>")
        return 2
    num = sys.argv[1]

    posts = json.loads(DATA.read_text(encoding="utf-8"))
    if num not in posts:
        print(f"post {num} is not in {DATA.name}. known: {', '.join(sorted(posts))}")
        return 2
    post = posts[num]
    card = f"{CARD_BASE}/{num}_{post['slug']}"

    targets = [
        ("LinkedIn", os.environ.get("ZAPIER_LINKEDIN", "").strip(), post["en"],
         post.get("first_comment_en", ""), f"{card}_en.png"),
        ("Facebook", os.environ.get("ZAPIER_FACEBOOK", "").strip(), post["he"],
         post.get("first_comment_he", ""), f"{card}_he.png"),
    ]

    sent, skipped = 0, []
    for label, hook, text, comment, image in targets:
        if not hook:
            skipped.append(label)
            print(f"[{label}] skipped: webhook secret is empty")
            continue
        payload = {"text": text, "message": text, "image_url": image}
        if comment:
            payload["first_comment"] = comment
            payload["link"] = comment
        if send(hook, payload, label):
            sent += 1

    if skipped:
        print(f"\nNot delivered to: {', '.join(skipped)}. "
              "Set the matching repository secret and re-run.")
    if sent == 0:
        print("\nNothing was published.")
        return 1
    print(f"\nPublished post {num} to {sent} of {len(targets)} platforms.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
