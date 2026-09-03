#!/usr/bin/env python3
"""
Store secrets in the Windows Credential Manager (DPAPI, current user only).

Prompts are in English on purpose: cmd.exe renders Hebrew right-to-left text
reversed, which made the previous version unreadable.

  setup_credentials.bat            all secrets
  setup_credentials.bat --check    show what is stored
  setup_credentials.bat --delete   wipe everything
"""

import getpass
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from invoice_processing.utils.credentials import (
    SECRET_KEYS,
    SERVICE,
    delete_secret,
    get_secret,
    set_secret,
)

LABELS = {
    "IMAP1_PASS": "Outlook IMAP password (avraham@lalum.co) - only for MAIL_MODE=imap",
    "SMTP_PASS": "SMTP send password - only for SEND_MODE=smtp",
}


def check():
    print(f"\nVault: {SERVICE}")
    for k in SECRET_KEYS:
        print(f"  {k:12} {'SET' if get_secret(k) else 'missing'}")
    print()


def ask(key):
    state = "SET" if get_secret(key) else "missing"
    print(f"\n{LABELS[key]}")
    value = getpass.getpass(f"  [{key}, currently {state}] (typing is hidden): ")
    if value.strip():
        set_secret(key, value.strip())
        print("  -> saved")
        return True
    print("  -> skipped")
    return False


def main():
    if "--check" in sys.argv:
        return check()
    if "--delete" in sys.argv:
        for k in SECRET_KEYS:
            delete_secret(k)
        print("All secrets removed from the vault.")
        return

    print("=" * 62)
    print("  LALUM invoice agent - credential setup")
    print("=" * 62)

    print("Typing is hidden. Empty Enter = skip, existing value is kept.")
    for key in SECRET_KEYS:
        ask(key)
    check()
    print("Secrets are encrypted in the Windows vault and exist in no file.")


if __name__ == "__main__":
    main()