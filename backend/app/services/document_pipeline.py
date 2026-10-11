import logging

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.clinical_document_extraction import ClinicalDocumentExtraction
from app.models.medical_document import MedicalDocument
from app.services.clinical_extraction_service import (
    calculate_confidence,
    count_fields,
    extract_document_data,
)
from app.services.ocr_service import (
    OcrUnavailableError,
    UnreadableDocumentError,
    extract_text_from_document,
    is_useful_text,
)

logger = logging.getLogger("jivsetu.pipeline")


def _fail(db: Session, document: MedicalDocument, reason: str, ocr_status: str = "failed") -> None:
    document.upload_status = "failed"
    document.ocr_status = ocr_status
    document.processing_error = reason[:500]
    db.commit()
    logger.warning("document %s failed: %s", document.id, reason)


def save_extraction(db: Session, document: MedicalDocument, text: str) -> ClinicalDocumentExtraction:
    data = extract_document_data(text=text, document_type=document.document_type)
    found = count_fields(data)
    extraction = db.query(ClinicalDocumentExtraction).filter_by(document_id=document.id).first()
    if not extraction:
        extraction = ClinicalDocumentExtraction(document_id=document.id)
        db.add(extraction)
    extraction.extracted_data = data
    extraction.fields_found = found
    extraction.confidence = calculate_confidence(data)
    extraction.extraction_status = "completed" if found else "failed"
    return extraction


def process_document_pipeline(document_id: int) -> None:
    """
    uploaded -> processing -> text extraction -> usefulness check
             -> structured extraction -> processed (awaiting clinician review)
    Any failure is recorded with a human-readable reason and can be retried.
    """
    db: Session = SessionLocal()
    try:
        document = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
        if not document:
            logger.error("document %s not found for processing", document_id)
            return

        document.upload_status = "processing"
        document.ocr_status = "processing"
        document.processing_error = None
        document.processing_attempts = (document.processing_attempts or 0) + 1
        db.commit()

        try:
            text, method = extract_text_from_document(document.file_path, document.mime_type)
        except OcrUnavailableError as exc:
            return _fail(db, document, str(exc))
        except UnreadableDocumentError as exc:
            return _fail(db, document, str(exc))
        except Exception:
            logger.exception("text extraction crashed for document %s", document_id)
            return _fail(db, document, "Text extraction failed unexpectedly. You can retry.")

        document.ocr_text = text or ""
        document.extraction_method = method

        if not is_useful_text(text):
            return _fail(db, document, "No readable text was found. Try a clearer, well-lit photo.")

        document.ocr_status = "completed"
        db.commit()

        try:
            extraction = save_extraction(db, document, text)
        except Exception:
            db.rollback()
            logger.exception("structured extraction crashed for document %s", document_id)
            document = db.get(MedicalDocument, document_id)
            document.upload_status = "processed"
            document.processing_error = "Text was read, but structured extraction failed."
            db.commit()
            return

        try:
            from app.services.measurement_sync import sync_measurements_from_extraction
            sync_measurements_from_extraction(db, document, extraction.extracted_data)
        except Exception:
            logger.exception("Failed to sync measurements for document %s", document_id)

        document.upload_status = "processed"
        if extraction.extraction_status == "failed":
            document.processing_error = "Text was read, but no clinical fields could be identified."
        db.commit()
        logger.info("document %s processed via %s (fields=%s)", document_id, method, extraction.fields_found)

    except Exception:
        db.rollback()
        logger.exception("pipeline crashed for document %s", document_id)
        document = db.get(MedicalDocument, document_id)
        if document:
            _fail(db, document, "Processing failed unexpectedly. You can retry.")
    finally:
        db.close()
