import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import audit
from app.db import get_db
from app.models.abha_link import AbhaLink
from app.models.consent import Consent
from app.models.patient_visit import PatientVisit
from app.routers.fhir import build_visit_export
from app.security import ensure_patient_access, require_staff
from app.services import abdm

logger = logging.getLogger("jivsetu.abdm")

router = APIRouter(prefix="/abdm", tags=["ABDM"], dependencies=[Depends(require_staff)])


def _adapter() -> abdm.AbdmAdapter:
    try:
        return abdm.get_adapter()
    except abdm.AbdmUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


def _link_view(link: AbhaLink | None) -> dict:
    if not link:
        return {"linked": False}
    return {
        "linked": True,
        "abha_number": abdm.mask_abha(link.abha_number),
        "abha_address": link.abha_address,
        "verified": bool(link.verified),
        "verification_source": link.verification_source,
    }


@router.get("/status")
def abdm_status():
    return abdm.status()


class AbhaLinkRequest(BaseModel):
    abha_number: str = Field(min_length=14, max_length=20)
    abha_address: str | None = Field(default=None, max_length=100)


@router.put("/patients/{patient_id}/abha")
def link_abha(patient_id: int, payload: AbhaLinkRequest, user=Depends(require_staff), db: Session = Depends(get_db)):
    """Record an ABHA for a patient. Format is checked; it is NOT verified unless ABDM verified it."""
    ensure_patient_access(user, patient_id)
    try:
        number = abdm.normalize_abha_number(payload.abha_number)
        address = abdm.normalize_abha_address(payload.abha_address)
    except abdm.AbdmInvalidInput as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    link = db.query(AbhaLink).filter(AbhaLink.patient_id == patient_id).first()
    if not link:
        link = AbhaLink(patient_id=patient_id)
        db.add(link)
    changed = link.abha_number != number
    link.abha_number, link.abha_address, link.linked_by = number, address, user["uid"]
    if changed or link.verified is None:
        link.verified, link.verification_source = False, "none"  # a new number is never inherited as verified
    audit.record(db, user, "abdm.abha_linked", "patient", patient_id)  # the number itself is never logged
    db.commit()
    return _link_view(link)


@router.get("/patients/{patient_id}/abha")
def get_abha(patient_id: int, user=Depends(require_staff), db: Session = Depends(get_db)):
    ensure_patient_access(user, patient_id)
    return _link_view(db.query(AbhaLink).filter(AbhaLink.patient_id == patient_id).first())


@router.post("/patients/{patient_id}/abha/verify")
def verify_abha(patient_id: int, user=Depends(require_staff), db: Session = Depends(get_db)):
    ensure_patient_access(user, patient_id)
    link = db.query(AbhaLink).filter(AbhaLink.patient_id == patient_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="No ABHA is linked to this patient.")
    adapter = _adapter()
    try:
        result = adapter.verify_abha(link.abha_number)
    except abdm.AbdmUnavailable as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    if result.get("verified") and not adapter.is_mock:
        link.verified, link.verification_source = True, "abdm"
    audit.record(db, user, "abdm.verify_attempt", "patient", patient_id, f"mock={adapter.is_mock}")
    db.commit()
    return {**result, "abha": _link_view(link)}


def _sharing_consent(db: Session, patient_id: int) -> bool:
    latest = (
        db.query(Consent)
        .filter(Consent.patient_id == patient_id, Consent.purpose == "abdm_sharing")
        .order_by(Consent.id.desc())
        .first()
    )
    return bool(latest and latest.granted)


@router.post("/visits/{visit_id}/share")
def share_visit(visit_id: int, user=Depends(require_staff), db: Session = Depends(get_db)):
    """Share a visit's FHIR Bundle with ABDM. Requires an ABHA and the patient's current sharing consent."""
    visit = db.get(PatientVisit, visit_id)
    if not visit or visit.hospital_id != user.get("hospital_id"):
        raise HTTPException(status_code=404, detail="Visit not found.")
    ensure_patient_access(user, int(visit.patient_id))
    adapter = _adapter()
    link = db.query(AbhaLink).filter(AbhaLink.patient_id == visit.patient_id).first()
    if not link:
        raise HTTPException(status_code=409, detail="Link the patient's ABHA before sharing.")
    if not _sharing_consent(db, int(visit.patient_id)):
        raise HTTPException(status_code=409, detail="The patient has not consented to sharing records through ABDM.")
    bundle = build_visit_export(db, visit_id, user)  # validated before leaving the system
    try:
        result = adapter.share_bundle(bundle, link.abha_number)
    except abdm.AbdmUnavailable as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    audit.record(db, user, "abdm.share_mock" if adapter.is_mock else "abdm.share", "visit", visit_id, f"resources={len(bundle['entry'])}")
    db.commit()
    return result
