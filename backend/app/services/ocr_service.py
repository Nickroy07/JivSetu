"""
Text extraction for uploaded medical documents.

Engines, in order of preference:
- PDF text layer (pypdf)        -> always available, no OCR needed.
- PaddleOCR (optional install)  -> images and scanned PDFs.
- Tesseract via pytesseract     -> images, if the binary is on PATH.

If no engine can read a document, OcrUnavailableError is raised so the
document is marked failed with an explicit reason instead of "success".
"""

import importlib.util
import io
import logging
import re
import shutil
from pathlib import Path

logger = logging.getLogger("jivsetu.ocr")

MIN_PDF_TEXT_CHARS = 40


class OcrUnavailableError(Exception):
    pass


class UnreadableDocumentError(Exception):
    pass


def _has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def available_engines() -> dict[str, bool]:
    return {
        "pdf_text": _has_module("pypdf"),
        "paddleocr": _has_module("paddleocr"),
        "tesseract": _has_module("pytesseract") and shutil.which("tesseract") is not None,
    }


def image_ocr_available() -> bool:
    engines = available_engines()
    return engines["paddleocr"] or engines["tesseract"]


# ---------------------------------------------------------------------------
# Validation helpers (used at upload time)
# ---------------------------------------------------------------------------

SIGNATURES = {
    "application/pdf": lambda b: b.startswith(b"%PDF-"),
    "image/png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    "image/webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


def sniff_mime(contents: bytes) -> str | None:
    for mime, check in SIGNATURES.items():
        if check(contents[:16]):
            return mime
    return None


def validate_structure(contents: bytes, mime: str) -> None:
    """Raise UnreadableDocumentError if the file is corrupted."""
    try:
        if mime == "application/pdf":
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(contents))
            if len(reader.pages) == 0:
                raise UnreadableDocumentError("The PDF has no pages.")
            if reader.is_encrypted:
                raise UnreadableDocumentError("Password-protected PDFs are not supported.")
        else:
            from PIL import Image

            with Image.open(io.BytesIO(contents)) as img:
                img.verify()
    except UnreadableDocumentError:
        raise
    except Exception as exc:
        raise UnreadableDocumentError("The file appears to be corrupted or incomplete.") from exc


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

_paddle_engine = None


def _paddle_text(path: Path) -> str:
    global _paddle_engine
    from paddleocr import PaddleOCR

    if _paddle_engine is None:
        _paddle_engine = PaddleOCR(lang="en", device="cpu")
    lines: list[str] = []
    for page in _paddle_engine.predict(input=str(path)):
        data = page.json() if callable(getattr(page, "json", None)) else getattr(page, "json", {})
        data = data.get("res", data) if isinstance(data, dict) else {}
        lines.extend(t.strip() for t in data.get("rec_texts", []) if t and t.strip())
    return "\n".join(lines)


def _tesseract_text(path: Path) -> str:
    import pytesseract
    from PIL import Image

    with Image.open(path) as img:
        return pytesseract.image_to_string(img)


def _pdf_text(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages[:30])


def extract_text_from_document(file_path: str, mime_type: str) -> tuple[str, str]:
    """Return (text, method). Raises on unavailable engine or unreadable input."""
    path = Path(file_path)
    if not path.is_file():
        raise UnreadableDocumentError("Stored file is missing.")

    engines = available_engines()

    if mime_type == "application/pdf":
        text = _pdf_text(path)
        if len(text.strip()) >= MIN_PDF_TEXT_CHARS:
            return text, "pdf_text"
        if engines["paddleocr"]:
            return _paddle_text(path), "paddleocr"
        raise OcrUnavailableError(
            "This PDF is a scanned image. Scanned-PDF OCR requires PaddleOCR, which is not installed on the server."
        )

    if engines["paddleocr"]:
        return _paddle_text(path), "paddleocr"
    if engines["tesseract"]:
        return _tesseract_text(path), "tesseract"
    raise OcrUnavailableError("Image OCR is not configured on the server (install PaddleOCR or Tesseract).")


def is_useful_text(text: str) -> bool:
    """At least a handful of real words — guards against OCR noise."""
    return len(re.findall(r"[A-Za-z]{3,}", text or "")) >= 5
