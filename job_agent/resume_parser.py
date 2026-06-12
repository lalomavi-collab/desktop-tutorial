"""
מודול פרסור קורות חיים מ-PDF.
מספק טקסט גולמי לשימוש ה-LLM ונתיב לקובץ להעלאה לטפסים.
"""

from pathlib import Path


def extract_text(resume_path: str | Path) -> str:
    """
    מחלץ טקסט מ-PDF של קורות החיים.
    מנסה pdfplumber ראשון, נופל ל-pypdf כגיבוי.
    """
    path = Path(resume_path)
    if not path.exists():
        raise FileNotFoundError(f"Resume not found: {path}")

    # Try pdfplumber (preserves layout better)
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages).strip()
        if text:
            return text
    except ImportError:
        pass

    # Fallback: pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    except ImportError:
        raise ImportError(
            "Install PDF parser: pip install pdfplumber  OR  pip install pypdf"
        )


def get_resume_path(resume_path: str | Path) -> Path:
    """מחזיר נתיב מאומת לקובץ ה-PDF להעלאה."""
    path = Path(resume_path)
    if not path.exists():
        raise FileNotFoundError(f"Resume file not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Resume must be a PDF file, got: {path.suffix}")
    return path.resolve()


def summarize_resume(resume_text: str, client, model: str = "claude-sonnet-4-6") -> str:
    """
    יוצר סיכום קצר של קורות החיים לשימוש בתשובות לשאלות סינון.
    """
    response = client.messages.create(
        model=model,
        max_tokens=512,
        system="You are a resume analyst. Extract key facts concisely.",
        messages=[{
            "role": "user",
            "content": (
                f"Summarize this resume in bullet points covering: "
                f"total years of experience, top skills, last job title, education.\n\n"
                f"{resume_text[:3000]}"
            )
        }]
    )
    return response.content[0].text
