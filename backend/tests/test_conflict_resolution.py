from tests.test_api import ANSWERS, make_text_pdf, submit_history


def conflict_case(client, patient):
    submit_history(client, patient)
    pdf = make_text_pdf(["Diagnosis: Type 2 Diabetes Mellitus", "Tab Metformin 500 mg - twice daily", "HbA1c: 8.1 %"])
    r = client.post("/documents/upload", headers=patient["headers"],
                    data={"patient_id": str(patient["patient_id"]), "document_type": "prescription",
                          "visit_id": str(patient["visit_id"])},
                    files={"file": ("rx.pdf", pdf, "application/pdf")})
    assert r.status_code == 201, r.text
    return f"/clinical-history/visits/{patient['visit_id']}"


def test_reason_is_required_and_decision_validated(client, patient, doctor_headers):
    base = conflict_case(client, patient)
    url = f"{base}/conflicts/diabetes/resolve"
    assert client.post(url, headers=doctor_headers, json={"decision": "patient_correct"}).status_code == 422
    assert client.post(url, headers=doctor_headers, json={"decision": "patient_correct", "reason": "   "}).status_code == 422
    assert client.post(url, headers=doctor_headers, json={"decision": "delete_it", "reason": "valid reason"}).status_code == 422
    case = client.get(f"{base}/complete", headers=doctor_headers).json()
    assert case["conflict_resolutions"] == {}


def test_patient_and_anonymous_cannot_resolve(client, patient):
    base = conflict_case(client, patient)
    body = {"decision": "document_correct", "reason": "I am the patient"}
    assert client.post(f"{base}/conflicts/diabetes/resolve", headers=patient["headers"], json=body).status_code in (401, 403)
    assert client.post(f"{base}/conflicts/diabetes/resolve", json=body).status_code == 401


def test_cannot_resolve_a_conflict_that_does_not_exist(client, patient, doctor_headers):
    base = conflict_case(client, patient)
    r = client.post(f"{base}/conflicts/allergies/resolve", headers=doctor_headers,
                    json={"decision": "patient_correct", "reason": "no such conflict"})
    assert r.status_code == 404


def test_resolution_is_recorded_separately_and_latest_wins(client, patient, doctor_headers):
    base = conflict_case(client, patient)
    url = f"{base}/conflicts/diabetes/resolve"
    first = client.post(url, headers=doctor_headers, json={"decision": "needs_follow_up", "reason": "Ask about HbA1c in clinic"})
    assert first.status_code == 200, first.text
    second = client.post(url, headers=doctor_headers, json={"decision": "document_correct", "reason": "Confirmed with patient"})
    assert second.status_code == 200

    case = client.get(f"{base}/complete", headers=doctor_headers).json()
    res = case["conflict_resolutions"]["diabetes"]
    assert res["decision"] == "document_correct" and res["reason"] == "Confirmed with patient"
    assert res["resolved_by"] == "test-doctor" and res["resolved_at"]
    # Original patient answer is untouched and the conflict is still shown alongside its sources.
    assert case["clinical_history"]["history_data"]["diabetes"] == ANSWERS["diabetes"]
    assert any(c["field"] == "diabetes" for c in case["draft_summary"]["conflicts"])


def test_patient_sees_no_resolutions(client, patient, doctor_headers):
    base = conflict_case(client, patient)
    client.post(f"{base}/conflicts/diabetes/resolve", headers=doctor_headers,
                json={"decision": "patient_correct", "reason": "Patient confirmed"})
    case = client.get(f"{base}/complete", headers=patient["headers"]).json()
    assert case["conflict_resolutions"] == {}


def test_cannot_accept_with_open_conflicts_but_can_after_resolving(client, patient, doctor_headers):
    base = conflict_case(client, patient)
    case = client.get(f"{base}/complete", headers=doctor_headers).json()
    fields = [c["field"] for c in case["draft_summary"]["conflicts"]]
    assert fields
    review = f"{base}/review"

    blocked = client.patch(review, headers=doctor_headers, json={"physician_status": "accepted"})
    assert blocked.status_code == 409, blocked.text
    assert "still open" in blocked.json()["detail"]
    # Saving a draft or returning the case is never blocked.
    assert client.patch(review, headers=doctor_headers, json={"physician_notes": "checking"}).status_code == 200
    assert client.patch(review, headers=doctor_headers,
                        json={"physician_status": "rejected", "physician_notes": "need more info"}).status_code == 200

    # One of several conflicts resolved is still not enough.
    for i, field in enumerate(fields):
        ok = client.post(f"{base}/conflicts/{field}/resolve", headers=doctor_headers,
                         json={"decision": "needs_follow_up", "reason": "Discussed in clinic"})
        assert ok.status_code == 200
        still = client.patch(review, headers=doctor_headers, json={"physician_status": "accepted"})
        assert still.status_code == (200 if i == len(fields) - 1 else 409), still.text
