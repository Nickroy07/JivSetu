from datetime import date

import pytest

from app.models.clinical_history import ClinicalHistory
from app.models.hospital import Hospital
from app.models.patient import Patient
from app.models.patient_visit import PatientVisit
from app.services.fhir import FhirExportError, build_visit_bundle, export_visit, rid, validate_bundle
from tests.test_api import ANSWERS


def _types(bundle):
    return [e["resource"]["resourceType"] for e in bundle["entry"]]


def _synthetic(answers=None, edits=None, documents=None):
    hospital = Hospital(id=1, hospital_code="SYN-H", name="Synthetic Hospital", is_active=True)
    patient = Patient(id=7, user_id=7, full_name="Synthetic Patient", mobile="9000000000", gender="female", date_of_birth=date(1980, 1, 2))
    visit = PatientVisit(id=11, patient_id=7, hospital_id=1, visit_date=date(2026, 10, 10), status="ready_for_review", chief_complaint="fever")
    history = ClinicalHistory(visit_id=11, patient_id=7, history_data=answers or {"chief_complaint": "fever", "diabetes": "yes", "medications": "Metformin 500 mg", "allergies": "Penicillin"},
                              red_flags=[{"message": "Severe chest pain", "severity": "urgent"}], doctor_edits=edits or {}, reviewed_by="dr-x")
    return dict(visit=visit, patient=patient, hospital=hospital, history=history, documents=documents or [], consents=[])


def test_bundle_is_valid_and_has_expected_resources():
    bundle = export_visit(**_synthetic())
    assert bundle["resourceType"] == "Bundle" and bundle["type"] == "collection"
    types = _types(bundle)
    for t in ("Organization", "Patient", "Encounter", "Condition", "MedicationStatement", "AllergyIntolerance", "Flag", "Provenance"):
        assert t in types, t
    assert validate_bundle(bundle) == []


def test_ids_are_stable_and_relationships_preserved():
    a, b = build_visit_bundle(**_synthetic()), build_visit_bundle(**_synthetic())
    assert [e["fullUrl"] for e in a["entry"]] == [e["fullUrl"] for e in b["entry"]]
    enc = next(e["resource"] for e in a["entry"] if e["resource"]["resourceType"] == "Encounter")
    assert enc["subject"]["reference"] == f"urn:uuid:{rid('Patient', 7)}"
    cond = next(e["resource"] for e in a["entry"] if e["resource"]["resourceType"] == "Condition")
    assert cond["encounter"]["reference"] == f"urn:uuid:{rid('Encounter', 11)}"


def test_nothing_is_invented_for_negative_answers():
    bundle = export_visit(**_synthetic(answers={"chief_complaint": "fever", "diabetes": "no", "medications": "none", "allergies": "none"}))
    types = _types(bundle)
    assert "AllergyIntolerance" not in types and "MedicationStatement" not in types
    assert sum(t == "Condition" for t in types) == 1  # only the chief complaint, no diabetes


def test_source_tags_distinguish_patient_and_clinician():
    bundle = export_visit(**_synthetic(edits={"medications": "Metformin 1000 mg"}))
    meds = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "MedicationStatement")
    assert meds["medicationCodeableConcept"]["text"] == "Metformin 1000 mg"
    assert {"system": "urn:jivsetu:info-source", "code": "clinician-verified"} in meds["meta"]["tag"]
    cond = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Condition")
    assert {"system": "urn:jivsetu:info-source", "code": "patient-reported"} in cond["meta"]["tag"]


def test_document_lab_values_become_preliminary_observations():
    docs = [{"id": 5, "document_type": "lab_report", "filename": "r.pdf", "mime_type": "application/pdf", "file_size": 100,
             "extraction": {"data": {"lab_values": [{"test_name": "HbA1c", "value": "8.1", "unit": "%"}, {"test_name": "Remark", "value": "borderline"}]}}}]
    bundle = export_visit(**_synthetic(documents=docs))
    obs = [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Observation"]
    assert len(obs) == 2 and all(o["status"] == "preliminary" for o in obs)
    assert obs[0]["valueQuantity"] == {"value": 8.1, "unit": "%"} and obs[1]["valueString"] == "borderline"
    assert obs[0]["derivedFrom"][0]["reference"] == f"urn:uuid:{rid('DocumentReference', 5)}"
    assert "url" in next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "DocumentReference")["content"][0]["attachment"]


def test_validator_rejects_bad_structure_and_dangling_references():
    bundle = build_visit_bundle(**_synthetic())
    bundle["entry"][1]["resource"]["subject"] = {"reference": "urn:uuid:does-not-exist"} if "subject" in bundle["entry"][1]["resource"] else {}
    enc = next(e for e in bundle["entry"] if e["resource"]["resourceType"] == "Encounter")
    enc["resource"]["subject"] = {"reference": "urn:uuid:missing"}
    enc["resource"]["status"] = "bogus"
    issues = validate_bundle(bundle)
    assert any("dangling" in i for i in issues) and any("invalid status" in i for i in issues)
    broken = build_visit_bundle(**_synthetic())
    broken["entry"][0]["resource"]["name"] = 123  # wrong type
    assert validate_bundle(broken)
    with pytest.raises(FhirExportError):
        raise FhirExportError(["x"])


def test_export_endpoint_access_control(client, patient, doctor_headers):
    vid = patient["visit_id"]
    assert client.get(f"/fhir/visits/{vid}/bundle").status_code == 401
    assert client.get(f"/fhir/visits/{vid}/bundle", headers=patient["headers"]).status_code == 403
    ok = client.get(f"/fhir/visits/{vid}/bundle", headers=doctor_headers)
    assert ok.status_code == 200, ok.text
    assert ok.headers["content-type"].startswith("application/fhir+json")
    assert validate_bundle(ok.json()) == []
    assert client.get("/fhir/visits/999999/bundle", headers=doctor_headers).status_code == 404
    assert client.get("/fhir/metadata").json()["fhir_version"].startswith("4.3")


def test_export_endpoint_hides_other_hospital(client, patient):
    from tests.test_auth_security import _login, _other_hospital_doctor

    _other_hospital_doctor()
    other = _login(client, "other-doctor")
    assert client.get(f"/fhir/visits/{patient['visit_id']}/bundle", headers=other).status_code == 404


def test_end_to_end_export_after_submission_and_upload(client, patient, doctor_headers):
    from tests.test_api import make_text_pdf, submit_history

    assert submit_history(client, patient).status_code == 200
    pdf = make_text_pdf(["City Clinic Prescription", "Tab Metformin 500 mg - twice daily", "HbA1c: 8.1 %"])
    up = client.post("/documents/upload", headers=patient["headers"],
                     data={"patient_id": str(patient["patient_id"]), "document_type": "prescription", "visit_id": str(patient["visit_id"])},
                     files={"file": ("rx.pdf", pdf, "application/pdf")})
    assert up.status_code == 201, up.text
    r = client.get(f"/fhir/visits/{patient['visit_id']}/bundle", headers=doctor_headers)
    assert r.status_code == 200, r.text
    bundle = r.json()
    assert validate_bundle(bundle) == []
    types = _types(bundle)
    for t in ("Patient", "Encounter", "Condition", "DocumentReference", "Observation", "Provenance"):
        assert t in types, t
    lab = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Observation")
    assert lab["status"] == "preliminary" and lab["valueQuantity"]["value"] == 8.1
