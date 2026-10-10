import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import audit
from app.db import get_db
from app.models.clinical_history import ClinicalHistory
from app.models.consent import Consent
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.patient_visit import PatientVisit
from app.routers.documents import load_documents, serialize_document
from app.security import ensure_patient_access, require_staff
from app.services.fhir import FHIR_VERSION, MAPPING_VERSION, FhirExportError, export_visit

logger = logging.getLogger("jivsetu.fhir")

router = APIRouter(prefix="/fhir", tags=["FHIR export"])


@router.get("/metadata")
def mapping_info():
    """What this export supports. This is an export mapping, not a FHIR server."""
    return {
        "fhir_version": FHIR_VERSION,
        "mapping_version": MAPPING_VERSION,
        "bundle_type": "collection",
        "resources": [
            "Organization", "Patient", "Encounter", "Condition", "MedicationStatement", "AllergyIntolerance",
            "Flag", "Observation", "DocumentReference", "Consent", "Provenance",
        ],
        "limitations": [
            "Free-text codes only; no SNOMED CT / LOINC / ICD assignment.",
            "Patient-reported and extracted facts are exported as unconfirmed or preliminary.",
            "Structural validation only; not validated against the official HL7 validator or ABDM profiles.",
            "The patient identifier is a JivSetu identifier, not an ABHA number.",
        ],
    }


def build_visit_export(db: Session, visit_id: int, user: dict) -> dict:
    """Validated FHIR Bundle for a visit the staff member may access. Raises HTTPException otherwise."""
    visit = db.get(PatientVisit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    ensure_patient_access(user, int(visit.patient_id))
    if visit.hospital_id != user.get("hospital_id"):
        raise HTTPException(status_code=404, detail="Visit not found.")

    patient = db.get(Patient, visit.patient_id)
    history = db.query(ClinicalHistory).filter(ClinicalHistory.visit_id == visit_id).first()
    documents = [
        serialize_document(d, e, include_text=False)
        for d, e in load_documents(db, int(visit.patient_id))
        if d.visit_id == visit.id and d.upload_status == "processed"
    ]
    consents = db.query(Consent).filter(Consent.patient_id == visit.patient_id).order_by(Consent.id).all()

    try:
        bundle = export_visit(
            visit=visit, patient=patient, hospital=db.get(Hospital, visit.hospital_id),
            history=history, documents=documents, consents=consents,
        )
    except FhirExportError as exc:
        logger.error("FHIR export failed validation for visit %s: %d issue(s)", visit_id, len(exc.issues))
        raise HTTPException(status_code=500, detail={"message": "The record could not be exported as valid FHIR.", "issues": exc.issues[:10]})

    return bundle


@router.get("/visits/{visit_id}/bundle")
def visit_bundle(visit_id: int, user=Depends(require_staff), db: Session = Depends(get_db)):
    """FHIR R4 collection Bundle for one visit. Staff only, limited to their own hospital."""
    bundle = build_visit_export(db, visit_id, user)
    audit.record(db, user, "fhir.export", "visit", visit_id, f"mapping={MAPPING_VERSION}")
    db.commit()
    return JSONResponse(content=bundle, media_type="application/fhir+json")
