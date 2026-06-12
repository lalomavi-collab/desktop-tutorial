"""
מודול פרסור קורות חיים — תומך ב-PDF ו-DOCX.
"""

from pathlib import Path


def extract_text(resume_path: str | Path) -> str:
    """מחלץ טקסט מ-PDF או DOCX."""
    path = Path(resume_path)
    if not path.exists():
        raise FileNotFoundError(f"Resume not found: {path}")

    ext = path.suffix.lower()

    if ext == ".docx":
        return _extract_docx(path)
    else:
        return _extract_pdf(path)


def _extract_docx(path: Path) -> str:
    """חילוץ טקסט מ-DOCX."""
    import zipfile
    import xml.etree.ElementTree as ET
    W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    with zipfile.ZipFile(path) as z:
        with z.open("word/document.xml") as f:
            root = ET.parse(f).getroot()
    lines = []
    for para in root.iter(f"{{{W}}}p"):
        line = "".join(t.text or "" for t in para.iter(f"{{{W}}}t"))
        if line.strip():
            lines.append(line.strip())
    return "\n".join(lines)


def _extract_pdf(path: Path) -> str:
    """חילוץ טקסט מ-PDF."""
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages).strip()
        if text:
            return text
    except ImportError:
        pass
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        return "\n".join(p.extract_text() or "" for p in reader.pages).strip()
    except ImportError:
        raise ImportError("pip install pdfplumber  OR  pip install pypdf")


def get_resume_path(resume_path: str | Path) -> Path:
    """מחזיר נתיב מאומת לקובץ קורות החיים (PDF או DOCX)."""
    path = Path(resume_path)
    if not path.exists():
        raise FileNotFoundError(f"Resume file not found: {path}")
    if path.suffix.lower() not in (".pdf", ".docx"):
        raise ValueError(f"Resume must be PDF or DOCX, got: {path.suffix}")
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
