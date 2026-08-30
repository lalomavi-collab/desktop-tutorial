#!/usr/bin/env python3
"""Publish one campaign post directly to LinkedIn and Facebook. No middleman.

Zapier is gone. This talks to the platform APIs itself, which means the failure
messages name the real problem (an expired token, a missing scope, a wrong page
id) instead of a webhook that silently accepted the request and dropped it.

  python3 scripts/publish_post.py 010
  python3 scripts/publish_post.py 010 --dry-run     # build and print, send nothing

Text comes from posts/campaign_sept_2026.json, images from
lalum-app/public/og/<num>_<slug>_<lang>.png. Both are read from the repository,
so publishing never waits on a deploy.

Secrets, all set as repository secrets:

  FACEBOOK_PAGE_ID        numeric id of the page
  FACEBOOK_ACCESS_TOKEN   PAGE token (not a user token) with pages_manage_posts
                          and pages_read_engagement. Use a long lived one.
  LINKEDIN_ACCESS_TOKEN   OAuth token with w_organization_social to post as the
                          company page, or w_member_social to post as a person
  LINKEDIN_AUTHOR_URN     urn:li:organization:<id>  or  urn:li:person:<id>

A platform whose secrets are missing is reported and skipped, so one
unconfigured side never blocks the other. The run fails if nothing at all was
delivered: a green run that published nothing is the worst of the three
outcomes, because it looks like success.
"""

import argparse
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "posts" / "campaign_sept_2026.json"
CARDS = ROOT / "lalum-app" / "public" / "og"

GRAPH = "https://graph.facebook.com/v21.0"
LI_API = "https://api.linkedin.com"
# The versioned LinkedIn API requires an explicit month. Bump it deliberately,
# after reading the migration notes; it is not a value to keep current for its
# own sake.
LI_VERSION = "202405"


# ----------------------------------------------------------------- transport

def _request(url, *, data=None, headers=None, method=None, timeout=60):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        body = raw.decode("utf-8", "replace")
        try:
            return resp.status, json.loads(body) if body else {}, dict(resp.headers)
        except json.JSONDecodeError:
            return resp.status, {"raw": body}, dict(resp.headers)


def post_json(url, payload, headers=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    return _request(url, data=json.dumps(payload).encode("utf-8"), headers=h, method="POST")


def post_multipart(url, fields, file_field, filename, file_bytes):
    """Upload a file without pulling in requests. Facebook wants multipart."""
    boundary = uuid.uuid4().hex
    ctype = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    parts = []
    for k, v in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8")
        )
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; '
        f'filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode("utf-8")
    )
    body = b"".join(parts) + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}", "Content-Length": str(len(body))}
    return _request(url, data=body, headers=headers, method="POST")


def explain(e):
    """Turn an HTTPError into the sentence that tells you what to fix."""
    if isinstance(e, urllib.error.HTTPError):
        try:
            body = json.loads(e.read().decode("utf-8", "replace"))
        except Exception:
            body = {}
        err = body.get("error") if isinstance(body.get("error"), dict) else body
        msg = (err or {}).get("message") or body.get("message") or str(body)[:300]
        hint = ""
        if e.code in (401, 403):
            hint = (" This is almost always the token: expired, issued for the wrong "
                    "account, or missing the scope the call needs.")
        elif e.code == 400 and "does not exist" in str(msg):
            hint = " Check the page id or the author URN."
        return f"HTTP {e.code}: {msg}{hint}"
    return str(e)


# ------------------------------------------------------------------ facebook

def publish_facebook(text, card, link, dry):
    page = os.environ.get("FACEBOOK_PAGE_ID", "").strip()
    token = os.environ.get("FACEBOOK_ACCESS_TOKEN", "").strip()
    if not (page and token):
        missing = [n for n, v in (("FACEBOOK_PAGE_ID", page), ("FACEBOOK_ACCESS_TOKEN", token)) if not v]
        print(f"[Facebook] skipped, missing: {', '.join(missing)}")
        return None

    # A photo post carries the card in the feed. A plain feed post with a link
    # would show whatever preview Facebook scrapes, which is not the card we
    # designed for this post.
    if dry:
        print(f"[Facebook] DRY RUN photo post to page {page}, card {card.name}, {len(text)} chars")
        return "dry-run"
    try:
        _, body, _ = post_multipart(
            f"{GRAPH}/{page}/photos",
            {"caption": text, "access_token": token},
            "source", card.name, card.read_bytes(),
        )
    except Exception as e:
        print(f"[Facebook] FAILED: {explain(e)}")
        return None

    post_id = body.get("post_id") or body.get("id")
    print(f"[Facebook] published: {post_id}")

    if link and post_id:
        try:
            post_json(f"{GRAPH}/{post_id}/comments",
                      {"message": link, "access_token": token})
            print("[Facebook] first comment added")
        except Exception as e:
            # The post is already live; a missing comment is not worth failing over.
            print(f"[Facebook] first comment failed (post is live): {explain(e)}")
    return post_id


# ------------------------------------------------------------------ linkedin

def _li_headers(token, extra=None):
    return {"Authorization": f"Bearer {token}", "LinkedIn-Version": LI_VERSION,
            "X-Restli-Protocol-Version": "2.0.0", **(extra or {})}


def publish_linkedin(text, card, alt, dry):
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN", "").strip()
    author = os.environ.get("LINKEDIN_AUTHOR_URN", "").strip()
    if not (token and author):
        missing = [n for n, v in (("LINKEDIN_ACCESS_TOKEN", token), ("LINKEDIN_AUTHOR_URN", author)) if not v]
        print(f"[LinkedIn] skipped, missing: {', '.join(missing)}")
        return None
    if not author.startswith("urn:li:"):
        print(f"[LinkedIn] skipped: LINKEDIN_AUTHOR_URN must look like "
              f"urn:li:organization:123 or urn:li:person:abc, got {author!r}")
        return None

    if dry:
        print(f"[LinkedIn] DRY RUN post as {author}, image {card.name}, {len(text)} chars")
        return "dry-run"

    # Images are a three step handshake: reserve, upload the bytes, then create
    # the post referencing the URN that came back.
    try:
        _, init, _ = post_json(
            f"{LI_API}/rest/images?action=initializeUpload",
            {"initializeUploadRequest": {"owner": author}},
            _li_headers(token),
        )
        value = init.get("value", {})
        upload_url, image_urn = value.get("uploadUrl"), value.get("image")
        if not (upload_url and image_urn):
            print(f"[LinkedIn] FAILED: upload could not be initialized: {init}")
            return None
        _request(upload_url, data=card.read_bytes(),
                 headers={"Authorization": f"Bearer {token}"}, method="PUT")
    except Exception as e:
        print(f"[LinkedIn] FAILED during image upload: {explain(e)}")
        return None

    payload = {
        "author": author,
        "commentary": text,
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [],
                         "thirdPartyDistributionChannels": []},
        "content": {"media": {"id": image_urn, "altText": alt[:200]}},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    try:
        _, _, headers = post_json(f"{LI_API}/rest/posts", payload, _li_headers(token))
    except Exception as e:
        print(f"[LinkedIn] FAILED: {explain(e)}")
        return None

    urn = headers.get("x-restli-id") or headers.get("X-RestLi-Id") or "(id not returned)"
    print(f"[LinkedIn] published: {urn}")
    return urn


# ---------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description="Publish one campaign post to LinkedIn and Facebook.")
    ap.add_argument("number", help="post number, for example 010")
    ap.add_argument("--dry-run", action="store_true",
                    help="build everything and print what would be sent, without sending")
    ap.add_argument("--only", choices=("linkedin", "facebook"), default=None,
                    help="publish to one platform only. Used where a post was approved "
                         "for one platform and not the other, so approval state is "
                         "enforced by the workflow rather than remembered by a person.")
    args = ap.parse_args()

    posts = json.loads(DATA.read_text(encoding="utf-8"))
    if args.number not in posts:
        print(f"post {args.number} is not in {DATA.name}. known: {', '.join(sorted(posts))}")
        return 2
    post = posts[args.number]
    slug = post["slug"]

    cards = {l: CARDS / f"{args.number}_{slug}_{l}.png" for l in ("he", "en")}
    needed = {"linkedin": ["en"], "facebook": ["he"]}.get(args.only, ["he", "en"])
    for lang in needed:
        if not cards[lang].exists():
            print(f"missing card image: {cards[lang].relative_to(ROOT)}")
            return 2

    scope = f", {args.only} only" if args.only else ""
    print(f"post {args.number} ({slug}){scope}{'  [dry run]' if args.dry_run else ''}\n")

    results = {}
    if args.only in (None, "linkedin"):
        results["LinkedIn"] = publish_linkedin(
            post["en"], cards["en"], post["en"].split("\n")[0], args.dry_run)
    if args.only in (None, "facebook"):
        results["Facebook"] = publish_facebook(
            post["he"], cards["he"], post.get("first_comment_he", ""), args.dry_run)

    done = [k for k, v in results.items() if v]
    if not done:
        print("\nNothing was published.")
        return 1
    print(f"\nPublished post {args.number} to: {', '.join(done)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
