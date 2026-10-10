import io

from PIL import Image

from tests.conftest import register_patient

ANSWERS = {
    "chief_complaint": "chest_pain",
    "chest_pain_onset": "Two hours ago",
    "chest_pain_severity": "severe",
    "breathlessness": "yes",
    "diabetes": "no",
    "medications": "none",
    "allergies": "none",
}


def make_text_pdf(lines: list[str]) -> bytes:
    """Minimal valid PDF with a real text layer (synthetic content)."""
    content = "BT /F1 11 Tf 50 750 Td 14 TL " + " ".join(f"({line}) Tj T*" for line in lines) + " ET"
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{obj}\nendobj\n".encode()
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), "white").save(buf, "PNG")
    return buf.getvalue()


def submit_history(client, patient, answers=ANSWERS):
    return client.post(
        "/clinical-history",
        headers=patient["headers"],
        json={"patient_id": patient["patient_id"], "visit_id": patient["visit_id"],
              "chief_complaint": answers.get("chief_complaint"), "history_data": answers},
    )


# 1. Health
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["database"]["status"] == "ok"
    assert "password" not in r.text.lower()
    assert client.get("/health/ready").status_code == 200


# 2. Authentication
def test_login_success_and_failure(client):
    assert client.post("/auth/login", data={"username": "test-doctor", "password": "wrong-password"}).status_code == 401
    assert client.post("/auth/login", data={"username": "nobody", "password": "whatever-123"}).status_code == 401
    r = client.post("/auth/login", data={"username": "test-doctor", "password": "Synthetic-Pass-123"})
    assert r.status_code == 200 and r.json()["role"] == "doctor"


# 3. Protected doctor endpoints
def test_doctor_endpoints_require_staff(client, patient):
    assert client.get("/doctor/queue").status_code == 401
    assert client.get("/doctor/queue", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.get("/doctor/queue", headers=patient["headers"]).status_code == 403
    assert client.get("/doctor/overview", headers=patient["headers"]).status_code == 403


# 5. Registration and validation
def test_patient_registration_validation(client):
    assert client.post("/auth/patient/send-otp", json={"mobile": "12345"}).status_code == 422
    assert client.post("/auth/patient/send-otp", json={"mobile": "1234567890"}).status_code == 422
    sent = client.post("/auth/patient/send-otp", json={"mobile": "9876500001"}).json()
    assert sent["delivery"] == "development" and len(sent["dev_otp"]) == 6
    wrong = "000000" if sent["dev_otp"] != "000000" else "111111"
    body = {"mobile": "9876500001", "name": "Synthetic"}
    assert client.post("/auth/patient/verify-otp", json=body | {"otp": wrong}).status_code == 400
    assert client.post("/auth/patient/verify-otp", json=body | {"otp": sent["dev_otp"]}).status_code == 200
    # Codes are single-use.
    assert client.post("/auth/patient/verify-otp", json=body | {"otp": sent["dev_otp"]}).status_code == 400


def test_otp_is_hidden_in_production(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "environment", "production")
    r = client.post("/auth/patient/send-otp", json={"mobile": "9876500009"})
    assert r.status_code == 503
    assert "dev_otp" not in r.text


def test_repeat_signin_reuses_open_visit(client):
    a = register_patient(client, "9876500002")
    b = register_patient(client, "9876500002")
    assert a["visit_id"] == b["visit_id"] and a["patient_id"] == b["patient_id"]


# 4, 6, 9. Records, queue and clinical history generation
def test_history_submission_and_queue(client, patient, doctor_headers):
    bad = client.post("/clinical-history", headers=patient["headers"], json={
        "patient_id": patient["patient_id"], "visit_id": patient["visit_id"], "history_data": {}})
    assert bad.status_code == 422
    r = submit_history(client, patient)
    assert r.status_code == 200, r.text
    missing = {m["field"] for m in r.json()["missing_information"]}
    assert "family_history" in missing and "chest_pain_radiation" in missing

    case = client.get(f"/clinical-history/visits/{patient['visit_id']}/complete", headers=doctor_headers).json()
    assert case["visit"]["status"] == "ready_for_review"
    assert case["draft_summary"]["kind"] == "auto_generated_draft"
    assert case["clinical_history"]["history_data"]["chest_pain_onset"] == "Two hours ago"

    q = client.get("/doctor/queue", params={"search": patient["patient_id"]}, headers=doctor_headers).json()
    assert any(i["visit_id"] == patient["visit_id"] for i in q["items"])
    q2 = client.get("/doctor/queue", params={"status": "ready_for_review", "page_size": 1}, headers=doctor_headers).json()
    assert len(q2["items"]) == 1 and q2["total"] >= 1
    assert client.get("/doctor/queue", params={"status": "nope"}, headers=doctor_headers).status_code == 422
    ov = client.get("/doctor/overview", headers=doctor_headers).json()
    assert ov["counts"]["awaiting_review"] >= 1
    assert any(a["action"] == "history.submitted" for a in ov["activity"])


def test_patient_cannot_read_other_patient(client, patient):
    other = register_patient(client, "9876500003")
    h = patient["headers"]
    assert client.get(f"/documents/patient/{other['patient_id']}", headers=h).status_code == 404
    assert client.get(f"/clinical-history/visits/{other['visit_id']}/complete", headers=h).status_code == 404
    r = client.post("/clinical-history", headers=h, json={
        "patient_id": other["patient_id"], "visit_id": other["visit_id"], "history_data": ANSWERS})
    assert r.status_code == 404


# 7. Upload validation
def test_upload_validation(client, patient):
    h, pid = patient["headers"], str(patient["patient_id"])

    def up(name, data, dtype="prescription", headers=h):
        return client.post("/documents/upload", headers=headers, data={"patient_id": pid, "document_type": dtype},
                           files={"file": (name, data, "application/pdf")})

    assert up("a.pdf", b"").status_code == 422
    assert up("evil.pdf", b"MZ\x90\x00 not a pdf at all").status_code == 415  # spoofed type
    assert up("broken.pdf", b"%PDF-1.4\ngarbage").status_code == 422  # corrupted
    assert up("ok.pdf", make_text_pdf(["Hello"]), dtype="bogus").status_code == 422
    assert up("a.pdf", b"%PDF", headers={}).status_code == 401


# 8. OCR success, conflicts, clinician correction
def test_document_pipeline_success_conflict_and_review(client, patient, doctor_headers):
    pid = str(patient["patient_id"])
    submit_history(client, patient)
    pdf = make_text_pdf([
        "City Clinic Prescription", "Doctor: Dr. Synthetic Example", "Date: 12/03/2026",
        "Diagnosis: Type 2 Diabetes Mellitus", "Tab Metformin 500 mg - twice daily", "HbA1c: 8.1 %",
    ])
    r = client.post("/documents/upload", headers=patient["headers"],
                    data={"patient_id": pid, "document_type": "prescription", "visit_id": str(patient["visit_id"])},
                    files={"file": ("../../rx.pdf", pdf, "application/pdf")})
    assert r.status_code == 201, r.text
    doc_id = r.json()["document"]["id"]
    assert r.json()["document"]["filename"] == "rx.pdf"  # path components stripped

    # BackgroundTasks run synchronously under TestClient.
    doc = client.get(f"/documents/{doc_id}", headers=patient["headers"]).json()["document"]
    assert doc["upload_status"] == "processed", doc
    assert doc["extraction_method"] == "pdf_text"
    data = doc["extraction"]["data"]
    assert any("Metformin" in m["name"] for m in data["medications"])
    assert any(lab["value"] == "8.1" for lab in data["lab_values"])
    assert doc["extraction"]["fields_found"] >= 3

    dup = client.post("/documents/upload", headers=patient["headers"],
                      data={"patient_id": pid, "document_type": "prescription"},
                      files={"file": ("copy.pdf", pdf, "application/pdf")})
    assert dup.json()["duplicate"] is True

    case = client.get(f"/clinical-history/visits/{patient['visit_id']}/complete", headers=doctor_headers).json()
    conflicts = case["draft_summary"]["conflicts"]
    assert {"medications", "diabetes"} <= {c["field"] for c in conflicts}
    assert conflicts[0]["documents"][0]["document_id"] == doc_id

    corrected = data | {"medications": [{"name": "Metformin", "strength": "500 mg", "frequency": "BD"}]}
    url = f"/documents/{doc_id}/extraction/review"
    assert client.put(url, headers=patient["headers"], json={"reviewed_data": corrected}).status_code == 403
    assert client.put(url, headers=doctor_headers, json={"reviewed_data": corrected}).status_code == 200
    again = client.get(f"/documents/{doc_id}", headers=doctor_headers).json()["document"]
    assert again["extraction"]["reviewed_data"]["medications"][0]["frequency"] == "BD"
    assert again["extraction"]["data"]["medications"][0]["frequency"] != "BD"  # machine output preserved

    f = client.get(f"/documents/{doc_id}/file", headers=doctor_headers)
    assert f.status_code == 200 and f.content.startswith(b"%PDF")
    assert client.get(f"/documents/{doc_id}/file").status_code == 401


def test_unreadable_image_fails_explicitly_and_can_retry(client, patient):
    from app.services.ocr_service import image_ocr_available

    r = client.post("/documents/upload", headers=patient["headers"],
                    data={"patient_id": str(patient["patient_id"]), "document_type": "lab_report"},
                    files={"file": ("scan.png", png_bytes(), "image/png")})
    assert r.status_code == 201
    doc = client.get(f"/documents/{r.json()['document']['id']}", headers=patient["headers"]).json()["document"]
    assert doc["upload_status"] == "failed" and doc["can_retry"] is True
    expected = "No readable text" if image_ocr_available() else "OCR is not configured"
    assert expected in doc["processing_error"]
    assert client.post(f"/documents/{doc['id']}/retry", headers=patient["headers"]).status_code == 202


# 10. Doctor review and edit persistence
def test_doctor_review_persists(client, patient, doctor_headers):
    vid = patient["visit_id"]
    submit_history(client, patient)
    url = f"/clinical-history/visits/{vid}/review"
    assert client.patch(url, headers=patient["headers"], json={"physician_status": "accepted"}).status_code == 403

    draft = client.patch(url, headers=doctor_headers,
                         json={"physician_notes": "Synthetic note", "doctor_edits": {"chest_pain_severity": "moderate"}})
    assert draft.status_code == 200
    assert draft.json()["clinical_history"]["physician_status"] == "pending"
    stamp = draft.json()["clinical_history"]["updated_at"]

    stale = client.patch(url, headers=doctor_headers,
                         json={"physician_status": "accepted", "expected_updated_at": "2000-01-01T00:00:00"})
    assert stale.status_code == 409
    assert client.patch(url, headers=doctor_headers, json={"physician_status": "bogus"}).status_code == 422

    final = client.patch(url, headers=doctor_headers, json={"physician_status": "amended", "expected_updated_at": stamp})
    assert final.status_code == 200, final.text
    assert final.json()["visit_status"] == "completed"

    h = client.get(f"/clinical-history/visits/{vid}/complete", headers=doctor_headers).json()["clinical_history"]
    assert h["doctor_edits"]["chest_pain_severity"] == "moderate"
    assert h["history_data"]["chest_pain_severity"] == "severe"  # patient answer untouched
    assert h["reviewed_by"] == "test-doctor" and h["reviewed_at"]

    assert submit_history(client, patient).status_code == 409  # cannot overwrite a reviewed history


# 11. Database errors
def test_database_failure_returns_503(client, doctor_headers, monkeypatch):
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Query

    def boom(*_a, **_k):
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(Query, "count", boom)
    r = client.get("/doctor/queue", headers=doctor_headers)
    assert r.status_code == 503
    assert "connection refused" not in r.text and "Traceback" not in r.text
