"""Maps a JivSetu visit to an HL7 FHIR R4 (R4B package) collection Bundle.

Internal models stay as they are; this module only *exports*. Principles:
- Nothing is invented: no SNOMED/LOINC/ICD codes are assigned (free-text `code.text` only),
  and "none" / unknown answers produce no resource instead of a fabricated negative finding.
- Patient-reported and document-extracted facts are exported as *unconfirmed* / *preliminary*.
  Only values the clinician edited are tagged `clinician-verified`.
- IDs are stable: uuid5 of (resource type, internal id), so re-exports reference the same resources.
- The patient identifier is a JivSetu identifier, NOT an ABHA number.
"""
import uuid
from datetime import datetime, timezone
from typing import Any

from fhir.resources.R4B.bundle import Bundle

from app.models.clinical_history import ClinicalHistory
from app.models.consent import Consent
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.patient_visit import PatientVisit
from app.services.case_summary import SECTION_ORDER, _is_negative, _is_unknown, collect_document_facts  # noqa: F401

MAPPING_VERSION = "jivsetu-fhir-r4-0.1"
FHIR_VERSION = "4.3.0 (R4B)"
NS = uuid.UUID("6f1b6c1e-3b7e-5a53-9c1a-4a9d6b1f0c11")  # fixed namespace for stable ids
ID_SYSTEM = "urn:jivsetu:id"
SOURCE_SYSTEM = "urn:jivsetu:info-source"

ENCOUNTER_STATUS = {
    "waiting": "planned",
    "in_interview": "in-progress",
    "documents_uploaded": "in-progress",
    "ready_for_review": "in-progress",
    "completed": "finished",
}
GENDER = {"male": "male", "female": "female", "other": "other", "m": "male", "f": "female"}
VALID_STATUS = {
    "Encounter": set(ENCOUNTER_STATUS.values()),
    "MedicationStatement": {"active", "completed", "entered-in-error", "intended", "stopped", "on-hold", "unknown", "not-taken"},
    "Observation": {"registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"},
    "DocumentReference": {"current", "superseded", "entered-in-error"},
    "Consent": {"draft", "proposed", "active", "rejected", "inactive", "entered-in-error"},
}


class FhirExportError(ValueError):
    def __init__(self, issues: list[str]):
        super().__init__("; ".join(issues))
        self.issues = issues


def rid(kind: str, key: Any) -> str:
    return str(uuid.uuid5(NS, f"{kind}:{key}"))


def _ref(kind: str, key: Any) -> dict[str, str]:
    return {"reference": f"urn:uuid:{rid(kind, key)}"}


def _entry(kind: str, key: Any, resource: dict[str, Any], source: str = "patient-reported") -> dict[str, Any]:
    resource = {"resourceType": kind, "id": rid(kind, key), **resource}
    resource["meta"] = {"tag": [{"system": SOURCE_SYSTEM, "code": source}, {"system": "urn:jivsetu:mapping", "code": MAPPING_VERSION}]}
    return {"fullUrl": f"urn:uuid:{resource['id']}", "resource": resource}


def _text(value: Any) -> str | None:
    """Human-readable string for an answer, or None when it carries no information."""
    if isinstance(value, (list, tuple)):
        value = ", ".join(str(v) for v in value if str(v).strip())
    text = str(value).strip() if value is not None else ""
    return None if _is_unknown(text) or _is_negative(text) else text


def build_visit_bundle(
    *,
    visit: PatientVisit,
    patient: Patient,
    hospital: Hospital | None,
    history: ClinicalHistory | None,
    documents: list[dict[str, Any]],
    consents: list[Consent],
) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    clinical_refs: list[dict[str, str]] = []

    if hospital:
        entries.append(
            _entry("Organization", hospital.id, {
                "identifier": [{"system": ID_SYSTEM, "value": hospital.hospital_code}],  # facility code, not an HFR id
                "active": bool(hospital.is_active),
                "name": hospital.name,
            }, "system")
        )

    p: dict[str, Any] = {
        "identifier": [{"system": ID_SYSTEM, "value": f"patient-{patient.id}"}],
        "name": [{"text": patient.full_name}],
        "telecom": [{"system": "phone", "value": patient.mobile}],
    }
    if patient.gender:
        p["gender"] = GENDER.get(patient.gender.strip().lower(), "unknown")
    if patient.date_of_birth:
        p["birthDate"] = patient.date_of_birth.isoformat()
    if hospital:
        p["managingOrganization"] = _ref("Organization", hospital.id)
    entries.append(_entry("Patient", patient.id, p))
    subject = _ref("Patient", patient.id)

    enc: dict[str, Any] = {
        "status": ENCOUNTER_STATUS.get(visit.status, "unknown"),
        "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB", "display": "ambulatory"},
        "subject": subject,
        "period": {"start": visit.visit_date.isoformat()},
    }
    if visit.chief_complaint:
        enc["reasonCode"] = [{"text": visit.chief_complaint}]
    if hospital:
        enc["serviceProvider"] = _ref("Organization", hospital.id)
    entries.append(_entry("Encounter", visit.id, enc))
    encounter = _ref("Encounter", visit.id)

    answers = dict((history.history_data or {}) if history else {})
    edits = dict((history.doctor_edits or {}) if history else {})

    def value_for(key: str) -> tuple[str | None, str]:
        if key in edits and str(edits[key]).strip():
            return _text(edits[key]), "clinician-verified"
        return _text(answers.get(key)), "patient-reported"

    def add(kind: str, key: Any, body: dict[str, Any], source: str) -> None:
        entries.append(_entry(kind, key, body, source))
        clinical_refs.append(_ref(kind, key))

    complaint, src = value_for("chief_complaint")
    if complaint:
        add("Condition", f"{visit.id}:complaint", {
            "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code": "unconfirmed"}]},
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-category", "code": "problem-list-item"}]}],
            "code": {"text": complaint}, "subject": subject, "encounter": encounter,
        }, src)

    diabetes, src = value_for("diabetes")
    if diabetes and diabetes.lower() in {"yes", "y", "हाँ", "हो", "होय"}:
        add("Condition", f"{visit.id}:diabetes", {
            "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code": "unconfirmed"}]},
            "code": {"text": "Diabetes (patient-reported)"}, "subject": subject, "encounter": encounter,
        }, src)

    meds, src = value_for("medications")
    if meds:
        add("MedicationStatement", f"{visit.id}:meds", {
            "status": "unknown",
            "medicationCodeableConcept": {"text": meds},
            "subject": subject, "context": encounter,
            "informationSource": subject,
        }, src)

    allergies, src = value_for("allergies")
    if allergies:
        add("AllergyIntolerance", f"{visit.id}:allergy", {
            "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "code": "unconfirmed"}]},
            "code": {"text": allergies}, "patient": subject, "encounter": encounter,
        }, src)

    for i, flag in enumerate(history.red_flags or [] if history else []):
        message = flag.get("message") if isinstance(flag, dict) else str(flag)
        if message:
            add("Flag", f"{visit.id}:redflag:{i}", {
                "status": "active", "code": {"text": message}, "subject": subject, "encounter": encounter,
            }, "system")

    doc_entries = []
    for doc in documents:
        doc_ref = _ref("DocumentReference", doc["id"])
        doc_entries.append(_entry("DocumentReference", doc["id"], {
            "status": "current",
            "docStatus": "preliminary",
            "type": {"text": doc.get("document_type") or "other"},
            "subject": subject,
            "content": [{"attachment": {
                "contentType": doc.get("mime_type") or "application/octet-stream",
                "title": doc.get("filename"),
                "size": doc.get("file_size"),
                "url": f"/documents/{doc['id']}/file",  # access-controlled API path; file bytes are not embedded
            }}],
            "context": {"encounter": [encounter]},
        }, "patient-uploaded"))
        extraction = doc.get("extraction") or {}
        reviewed = bool(extraction.get("reviewed_data"))
        data = extraction.get("reviewed_data") or extraction.get("data") or {}
        for j, lab in enumerate(data.get("lab_values") or []):
            if not lab.get("test_name") or lab.get("value") in (None, ""):
                continue
            obs: dict[str, Any] = {
                "status": "final" if reviewed else "preliminary",
                "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}],
                "code": {"text": str(lab["test_name"])},
                "subject": subject, "encounter": encounter,
                "derivedFrom": [doc_ref],
            }
            try:
                quantity: dict[str, Any] = {"value": float(lab["value"])}
                if lab.get("unit"):
                    quantity["unit"] = str(lab["unit"])
                obs["valueQuantity"] = quantity
            except (TypeError, ValueError):
                obs["valueString"] = str(lab["value"])
            add("Observation", f"{doc['id']}:{j}", obs, "clinician-verified" if reviewed else "document-extracted")
        for j, med in enumerate(data.get("medications") or []):
            if not med.get("name"):
                continue
            label = " ".join(str(x) for x in (med.get("name"), med.get("strength"), med.get("frequency")) if x)
            add("MedicationStatement", f"{doc['id']}:med:{j}", {
                "status": "unknown", "medicationCodeableConcept": {"text": label},
                "subject": subject, "context": encounter, "derivedFrom": [doc_ref],
            }, "clinician-verified" if reviewed else "document-extracted")
    entries.extend(doc_entries)

    latest: dict[str, Consent] = {}
    for c in consents:  # ledger is ordered oldest -> newest; newest per purpose wins
        latest[c.purpose] = c
    for purpose, c in latest.items():
        entries.append(_entry("Consent", f"{patient.id}:{purpose}", {
            "status": "active" if c.granted else "rejected",
            "scope": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/consentscope", "code": "patient-privacy"}]},
            "category": [{"text": purpose}],
            "patient": subject,
            "dateTime": c.created_at.replace(tzinfo=timezone.utc).isoformat() if c.created_at else None,
        }, "patient-reported"))

    if clinical_refs:
        agents = [{"type": {"text": "assembler"}, "who": {"display": f"JivSetu AI draft assembly ({MAPPING_VERSION})"}}]
        if history and history.reviewed_by:
            agents.append({"type": {"text": "verifier"}, "who": {"identifier": {"system": ID_SYSTEM, "value": history.reviewed_by}}})
        entries.append(_entry("Provenance", visit.id, {
            "target": clinical_refs,
            "recorded": datetime.now(timezone.utc).isoformat(),
            "agent": agents,
        }, "system"))

    # `dateTime: None` entries are dropped so the resource validates cleanly.
    for e in entries:
        e["resource"] = {k: v for k, v in e["resource"].items() if v is not None}

    return {
        "resourceType": "Bundle",
        "id": rid("Bundle", visit.id),
        "type": "collection",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entry": entries,
    }


def validate_bundle(bundle: dict[str, Any]) -> list[str]:
    """Structural R4B validation (types, required elements, cardinality) plus
    reference integrity and the status codes this mapper emits.
    It is NOT a profile / terminology validation against the official HL7 validator."""
    issues: list[str] = []
    try:
        Bundle.model_validate(bundle)
    except Exception as exc:  # pydantic.ValidationError lists every failing path
        issues.extend(f"{err.get('loc')}: {err.get('msg')}" for err in getattr(exc, "errors", lambda: [{"loc": "bundle", "msg": str(exc)}])())

    urls = {e["fullUrl"] for e in bundle.get("entry", [])}

    def walk(node: Any, path: str) -> None:
        if isinstance(node, dict):
            ref = node.get("reference")
            if isinstance(ref, str) and ref.startswith("urn:uuid:") and ref not in urls:
                issues.append(f"{path}: dangling reference {ref}")
            for k, v in node.items():
                walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")

    for e in bundle.get("entry", []):
        r = e["resource"]
        allowed = VALID_STATUS.get(r["resourceType"])
        if allowed and r.get("status") not in allowed:
            issues.append(f"{r['resourceType']}/{r['id']}: invalid status {r.get('status')!r}")
        walk(r, f"{r['resourceType']}/{r['id']}")
    return issues


def export_visit(**kwargs: Any) -> dict[str, Any]:
    bundle = build_visit_bundle(**kwargs)
    issues = validate_bundle(bundle)
    if issues:
        raise FhirExportError(issues)
    return bundle
