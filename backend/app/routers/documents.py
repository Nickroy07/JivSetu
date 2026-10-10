import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import audit
from app.config import settings
from app.db import get_db
from app.models.clinical_document_extraction import ClinicalDocumentExtraction
from app.models.medical_document import MedicalDocument
from app.models.patient import Patient
from app.models.patient_visit import PatientVisit
from app.security import ensure_patient_access, get_current_user, require_staff
from app.services.document_pipeline import process_document_pipeline
from app.services.ocr_service import (
    UnreadableDocumentError,
    available_engines,
    image_ocr_available,
    sniff_mime,
    validate_structure,
)

logger = logging.getLogger("jivsetu.documents")

router = APIRouter(prefix="/documents", tags=["Medical Documents"])

STORAGE_DIR = Path(settings.document_storage_path).resolve()
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}

DOCUMENT_TYPES = {
    "prescription",
    "lab_report",
    "discharge_summary",
    "xray_report",
    "mri_report",
    "ct_report",
    "handwritten_note",
    "other",
}

MAX_FILE_SIZE = settings.max_upload_mb * 1024 * 1024


def serialize_document(document: MedicalDocument, extraction: ClinicalDocumentExtraction | None, *, include_text: bool) -> dict[str, Any]:
    item: dict[str, Any] = {
        "id": int(document.id),
        "patient_id": int(document.patient_id) if document.patient_id else None,
        "visit_id": int(document.visit_id) if document.visit_id else None,
        "document_type": document.document_type,
        "filename": document.original_filename,
        "mime_type": document.mime_type,
        "file_size": int(document.file_size),
        "upload_status": document.upload_status,
        "ocr_status": document.ocr_status,
        "extraction_method": document.extraction_method,
        "processing": document.upload_status in ("uploaded", "processing"),
        "processing_error": document.processing_error,
        "can_retry": document.upload_status == "failed",
        "created_at": document.created_at.isoformat() if document.created_at else None,
        "updated_at": document.updated_at.isoformat() if document.updated_at else None,
        "extraction": None,
    }
    if extraction:
        item["extraction"] = {
            "status": extraction.extraction_status,
            "data": extraction.extracted_data or {},
            "reviewed_data": extraction.reviewed_data,
            "reviewed_by": extraction.reviewed_by,
            "reviewed_at": extraction.reviewed_at.isoformat() if extraction.reviewed_at else None,
            "fields_found": int(extraction.fields_found or 0),
            "coverage": float(extraction.confidence),
        }
    if include_text:
        item["ocr_text"] = document.ocr_text or ""
    return item


def load_documents(db: Session, patient_id: int) -> list[tuple[MedicalDocument, ClinicalDocumentExtraction | None]]:
    rows = (
        db.query(MedicalDocument, ClinicalDocumentExtraction)
        .outerjoin(ClinicalDocumentExtraction, ClinicalDocumentExtraction.document_id == MedicalDocument.id)
        .filter(MedicalDocument.patient_id == patient_id)
        .order_by(MedicalDocument.created_at.desc(), MedicalDocument.id.desc())
        .all()
    )
    return [(doc, ext) for doc, ext in rows]


def _get_document(db: Session, document_id: int, user: dict) -> MedicalDocument:
    document = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    ensure_patient_access(user, int(document.patient_id or 0))
    return document


@router.get("/capabilities")
def capabilities():
    """What the server can actually read, so the UI can set expectations."""
    return {
        "accepted_types": list(EXTENSIONS.keys()),
        "max_upload_mb": settings.max_upload_mb,
        "document_types": sorted(DOCUMENT_TYPES),
        "engines": available_engines(),
        "image_ocr_available": image_ocr_available(),
    }


@router.post("/upload", status_code=201)
async def upload_medical_document(
    background_tasks: BackgroundTasks,
    patient_id: int = Form(...),
    document_type: str = Form(...),
    visit_id: int | None = Form(None),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_patient_access(user, patient_id)
    if not db.get(Patient, patient_id):
        raise HTTPException(status_code=404, detail="Record not found.")

    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=422, detail="Choose a valid document type.")

    if visit_id is not None:
        visit = db.get(PatientVisit, visit_id)
        if not visit or int(visit.patient_id) != patient_id:
            raise HTTPException(status_code=422, detail="Visit does not belong to this patient.")
    else:
        visit = None

    contents = await file.read(MAX_FILE_SIZE + 1)
    if not contents:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File is larger than {settings.max_upload_mb} MB.")

    # Trust the bytes, not the browser-supplied content type or filename.
    mime = sniff_mime(contents)
    if mime is None:
        raise HTTPException(status_code=415, detail="Unsupported file. Upload a PDF, JPG, PNG or WEBP.")
    try:
        validate_structure(contents, mime)
    except UnreadableDocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    digest = hashlib.sha256(contents).hexdigest()
    existing = (
        db.query(MedicalDocument)
        .filter(MedicalDocument.patient_id == patient_id, MedicalDocument.sha256 == digest)
        .first()
    )
    if existing and existing.upload_status != "failed":
        extraction = db.query(ClinicalDocumentExtraction).filter_by(document_id=existing.id).first()
        return {
            "success": True,
            "duplicate": True,
            "message": "This document was already uploaded.",
            "document": serialize_document(existing, extraction, include_text=False),
        }

    stored_filename = f"{uuid4().hex}{EXTENSIONS[mime]}"
    destination = STORAGE_DIR / stored_filename
    safe_name = Path(file.filename or "document").name[:200] or "document"

    try:
        destination.write_bytes(contents)
    except OSError:
        logger.exception("could not write upload to storage")
        raise HTTPException(status_code=503, detail="Document storage is unavailable. Please try again.")

    document = MedicalDocument(
        patient_id=patient_id,
        visit_id=visit_id,
        document_type=document_type,
        original_filename=safe_name,
        stored_filename=stored_filename,
        file_path=str(destination),
        mime_type=mime,
        file_size=len(contents),
        sha256=digest,
        upload_status="uploaded",
        ocr_status="pending",
    )
    try:
        db.add(document)
        if visit and visit.status in ("waiting", "in_interview"):
            visit.status = "documents_uploaded"
        db.flush()
        audit.record(db, user, "document.uploaded", "document", document.id, f"type={document_type}")
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise

    background_tasks.add_task(process_document_pipeline, int(document.id))

    return {
        "success": True,
        "duplicate": False,
        "message": "Upload received. Reading the document now.",
        "document": serialize_document(document, None, include_text=False),
    }


@router.get("/patient/{patient_id}")
def get_patient_documents(patient_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_patient_access(user, patient_id)
    items = [serialize_document(d, e, include_text=False) for d, e in load_documents(db, patient_id)]
    return {"success": True, "patient_id": patient_id, "total": len(items), "documents": items}


@router.get("/patient/{patient_id}/review")
def get_patient_document_review(patient_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_patient_access(user, patient_id)
    items = [serialize_document(d, e, include_text=True) for d, e in load_documents(db, patient_id)]
    return {"success": True, "patient_id": patient_id, "total": len(items), "documents": items}


@router.get("/{document_id}")
def get_document(document_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    document = _get_document(db, document_id, user)
    extraction = db.query(ClinicalDocumentExtraction).filter_by(document_id=document.id).first()
    return {"success": True, "document": serialize_document(document, extraction, include_text=True)}


@router.get("/{document_id}/file")
def view_document_file(document_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    document = _get_document(db, document_id, user)
    file_path = (STORAGE_DIR / document.stored_filename).resolve()
    if STORAGE_DIR not in file_path.parents or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Stored file not found.")
    return FileResponse(
        path=file_path,
        media_type=document.mime_type,
        filename=document.original_filename,
        content_disposition_type="inline",
    )


@router.post("/{document_id}/retry", status_code=202)
def retry_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = _get_document(db, document_id, user)
    if document.upload_status in ("uploaded", "processing"):
        raise HTTPException(status_code=409, detail="This document is already being processed.")
    if document.processing_attempts and document.processing_attempts >= 5:
        raise HTTPException(status_code=429, detail="Retry limit reached. Please upload a clearer copy.")
    document.upload_status = "uploaded"
    document.ocr_status = "pending"
    document.processing_error = None
    db.commit()
    background_tasks.add_task(process_document_pipeline, int(document.id))
    return {"success": True, "document_id": int(document.id), "status": "uploaded"}


class ExtractionReview(BaseModel):
    reviewed_data: dict[str, Any]


@router.put("/{document_id}/extraction/review")
def review_extraction(
    document_id: int,
    payload: ExtractionReview,
    user=Depends(require_staff),
    db: Session = Depends(get_db),
):
    document = _get_document(db, document_id, user)
    extraction = db.query(ClinicalDocumentExtraction).filter_by(document_id=document.id).first()
    if not extraction:
        raise HTTPException(status_code=409, detail="This document has no extraction to review yet.")
    extraction.reviewed_data = payload.reviewed_data
    extraction.reviewed_by = user["sub"]
    extraction.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    audit.record(db, user, "extraction.reviewed", "document", document.id)
    db.commit()
    db.refresh(extraction)
    return {"success": True, "document": serialize_document(document, extraction, include_text=False)}
