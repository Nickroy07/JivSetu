from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import audit
from app.db import get_db
from app.models.medical_document import MedicalDocument
from app.routers.documents import serialize_document
from app.security import ensure_patient_access, require_staff
from app.services.document_pipeline import save_extraction

router = APIRouter(prefix="/documents", tags=["Clinical Extraction"])


@router.post("/{document_id}/extract")
def rerun_extraction(document_id: int, user=Depends(require_staff), db: Session = Depends(get_db)):
    """Re-run structured extraction on already-read text (no OCR)."""
    document = db.get(MedicalDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    ensure_patient_access(user, int(document.patient_id or 0))
    if document.ocr_status != "completed" or not (document.ocr_text or "").strip():
        raise HTTPException(status_code=409, detail="The document text has not been read successfully yet.")
    extraction = save_extraction(db, document, document.ocr_text)
    audit.record(db, user, "extraction.rerun", "document", document.id)
    db.commit()
    db.refresh(extraction)
    return {"success": True, "document": serialize_document(document, extraction, include_text=False)}
