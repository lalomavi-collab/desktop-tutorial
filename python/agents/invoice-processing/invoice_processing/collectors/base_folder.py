"""נתיב תיקיית החשבוניות הראשית — מקור אמת יחיד.

סדר עדיפויות:
1. משתנה הסביבה INVOICE_BASE_FOLDER (מקובץ .env)
2. ב-Windows: תיקיית OneDrive של המשרד
3. ב-macOS/Linux: תיקיית Desktop
"""

import os
from pathlib import Path

WINDOWS_DEFAULT = r"C:\Users\lalom\OneDrive\שולחן העבודה\LALUM\חשבוניות"
UNIX_DEFAULT = "~/Desktop/LALUM/חשבוניות"


def get_base_folder() -> Path:
    env = os.environ.get("INVOICE_BASE_FOLDER")
    if env:
        return Path(env).expanduser()
    if os.name == "nt":
        return Path(WINDOWS_DEFAULT)
    return Path(UNIX_DEFAULT).expanduser()
