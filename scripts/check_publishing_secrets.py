#!/usr/bin/env python3
"""Check the publishing secrets without publishing anything.

Every call here is a GET. Nothing is posted, nothing is changed. The point is to
find out whether a token works *before* a real post depends on it, because the
alternative is discovering a wrong secret by watching a campaign post fail.

What it actually catches, in the order these mistakes happen:

  1. A user token saved where a page token belongs. This is the common one:
     both come from the same screen, both look alike, and only one can post to
     a page. `GET /me` with a page token answers with the page; with a user
     token it answers with the person.
  2. The right token for the wrong page, or a page id copied from somewhere
     else. The id `/me` reports has to equal FACEBOOK_PAGE_ID.
  3. An expired or revoked token, which fails the call outright.
  4. A LinkedIn URN that is not a URN, which the API would reject only at the
     moment of posting.

Scope is not read here: Graph does not report a page token's permissions
without an app token, and asking for the app secret to check a scope is a worse
trade than letting the first real post report it.

  python3 scripts/check_publishing_secrets.py
  python3 scripts/check_publishing_secrets.py --only facebook
"""

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

GRAPH = "https://graph.facebook.com/v21.0"
LI_API = "https://api.linkedin.com"
LI_VERSION = "202405"


def get(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", "replace")
        return resp.status, json.loads(body) if body else {}


def explain(e):
    """The platform's own words, not a generic failure line."""
    if isinstance(e, urllib.error.HTTPError):
        raw = e.read().decode("utf-8", "replace")
        try:
            err = json.loads(raw).get("error", {})
        except json.JSONDecodeError:
            return f"HTTP {e.code}: {raw[:300]}"
        msg = err.get("message") or err.get("error_description") or raw[:300]
        code = err.get("code")
        hint = ""
        if code == 190:
            hint = ("  (the token expired, was revoked, or the password changed; "
                    "generate a new one)")
        elif code == 100:
            hint = "  (the id does not exist or this token cannot see it)"
        return f"HTTP {e.code}, code {code}: {msg}{hint}"
    return f"{type(e).__name__}: {e}"


def check_facebook():
    page = os.environ.get("FACEBOOK_PAGE_ID", "").strip()
    token = os.environ.get("FACEBOOK_ACCESS_TOKEN", "").strip()
    missing = [n for n, v in (("FACEBOOK_PAGE_ID", page), ("FACEBOOK_ACCESS_TOKEN", token)) if not v]
    if missing:
        print(f"[Facebook] not configured, missing: {', '.join(missing)}")
        return None

    # The value itself is masked by Actions wherever it appears in a log, which
    # is right for a token and unhelpful here: when the id is wrong, "***" says
    # nothing about *how* it is wrong. A shape and a digest describe it without
    # printing it, and the digest makes two runs comparable, so "I updated the
    # secret" can be checked rather than believed.
    shape = f"{len(page)} characters, {'all digits' if page.isdigit() else 'NOT all digits'}"
    digest = hashlib.sha256(page.encode()).hexdigest()[:12]
    print(f"[Facebook] the FACEBOOK_PAGE_ID secret: {shape}, fingerprint {digest}")
    query = urllib.parse.urlencode({"fields": "id,name,category", "access_token": token})
    try:
        _, me = get(f"{GRAPH}/me?{query}")
    except Exception as e:
        print(f"[Facebook] FAILED: {explain(e)}")
        return False

    who, name = str(me.get("id", "")), me.get("name", "")
    category = me.get("category")
    if category is None:
        print(f"[Facebook] FAILED: this is a USER token ({name}), not a page token.")
        print("[Facebook]   The page token is the access_token field *inside* the page object")
        print("[Facebook]   returned by  me/accounts?fields=id,name,access_token")
        return False
    if who != page:
        want = hashlib.sha256(who.encode()).hexdigest()[:12]
        print(f"[Facebook] FAILED: the token belongs to page {who} ({name}),")
        print(f"[Facebook]   and FACEBOOK_PAGE_ID holds a different value.")
        print(f"[Facebook]   Set the secret to {who} exactly. Its fingerprint will then")
        print(f"[Facebook]   read {want}; anything else means the edit did not land where")
        print(f"[Facebook]   Actions reads from (check the Actions tab of the secrets page,")
        print(f"[Facebook]   not Codespaces or Dependabot, and this repository, not an org).")
        return False

    print(f"[Facebook] OK: page token for \"{name}\" ({who}), category {category}.")
    return True


def check_linkedin():
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN", "").strip()
    urn = os.environ.get("LINKEDIN_AUTHOR_URN", "").strip()
    missing = [n for n, v in (("LINKEDIN_ACCESS_TOKEN", token), ("LINKEDIN_AUTHOR_URN", urn)) if not v]
    if missing:
        print(f"[LinkedIn] not configured, missing: {', '.join(missing)}")
        return None

    ok = True
    if not (urn.startswith("urn:li:organization:") or urn.startswith("urn:li:person:")):
        print(f"[LinkedIn] FAILED: LINKEDIN_AUTHOR_URN is not a URN. It must start with")
        print("[LinkedIn]   urn:li:organization:  (to post as the company page) or")
        print("[LinkedIn]   urn:li:person:        (to post from a personal profile)")
        ok = False
    else:
        print(f"[LinkedIn] author urn looks well formed: {urn}")

    # userinfo answers for a member token. An organization-only token legitimately
    # cannot call it, so a 403 there is not a failure on its own.
    try:
        _, who = get(f"{LI_API}/v2/userinfo", {"Authorization": f"Bearer {token}"})
        print(f"[LinkedIn] OK: token accepted, identifies {who.get('name', 'the account')}.")
    except urllib.error.HTTPError as e:
        if e.code in (401,):
            print(f"[LinkedIn] FAILED: {explain(e)}")
            print("[LinkedIn]   A LinkedIn token expires about 60 days after it is issued.")
            ok = False
        elif e.code in (403,):
            print("[LinkedIn] token did not pass userinfo (403). That is expected for an")
            print("[LinkedIn]   organization-only token, so this is not treated as a failure.")
        else:
            print(f"[LinkedIn] FAILED: {explain(e)}")
            ok = False
    except Exception as e:
        print(f"[LinkedIn] FAILED: {explain(e)}")
        ok = False
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only", choices=["facebook", "linkedin"],
                    help="check one platform instead of both")
    args = ap.parse_args()

    results = {}
    if args.only in (None, "facebook"):
        results["facebook"] = check_facebook()
    if args.only in (None, "linkedin"):
        print()
        results["linkedin"] = check_linkedin()

    print()
    failed = [k for k, v in results.items() if v is False]
    configured = [k for k, v in results.items() if v is True]
    if failed:
        print(f"FAILED: {', '.join(failed)}. Nothing was published; fix the secret and run again.")
        return 1
    if not configured:
        print("Nothing is configured yet. Set the secrets and run this again.")
        return 1
    print(f"OK: {', '.join(configured)} ready to publish. Nothing was sent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
