from datetime import date
from app.db import SessionLocal
from app.models.clinical_measurement import ClinicalMeasurement


def test_health_monitoring_endpoints(client, doctor_headers, patient):
    patient_id = patient["patient_id"]

    # 1. Add measurement for patient directly in DB
    with SessionLocal() as db:
        meas1 = ClinicalMeasurement(
            patient_id=patient_id,
            test_code="hba1c",
            test_name="Glycated Hemoglobin (HbA1c)",
            category="diabetes",
            value=8.4,
            unit="%",
            test_date=date(2026, 2, 1),
            verification_status="clinician_verified"
        )
        meas2 = ClinicalMeasurement(
            patient_id=patient_id,
            test_code="hba1c",
            test_name="Glycated Hemoglobin (HbA1c)",
            category="diabetes",
            value=7.9,
            unit="%",
            test_date=date(2026, 6, 1),
            verification_status="extracted_unverified"
        )
        db.add_all([meas1, meas2])
        db.commit()
        meas2_id = meas2.id

    # 2. Query patient dashboard
    resp = client.get(
        f"/health-monitoring/patient/{patient_id}/dashboard",
        headers=doctor_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["patient_id"] == patient_id
    assert len(data["overview_cards"]) >= 1

    card = next(c for c in data["overview_cards"] if c["test_code"] == "hba1c")
    assert card["current_value"] == 7.9
    assert card["previous_value"] == 8.4
    assert card["absolute_change"] == -0.5
    assert card["trend_direction"] == "decreasing"
    assert card["is_percentage_metric"] is True
    assert card["reference_status"] == "above_range"

    # 3. Query timeline
    tl_resp = client.get(
        f"/health-monitoring/patient/{patient_id}/timeline?test_code=hba1c",
        headers=doctor_headers
    )
    assert tl_resp.status_code == 200, tl_resp.text
    tl_data = tl_resp.json()
    assert tl_data["count"] == 2
    assert tl_data["items"][0]["value"] == 8.4
    assert tl_data["items"][1]["value"] == 7.9

    # 4. Clinician verification of unverified measurement
    verify_resp = client.patch(
        f"/health-monitoring/measurements/{meas2_id}/verify",
        headers=doctor_headers,
        json={
            "verified": True,
            "notes": "Verified by Dr. Mehta after consulting patient's laboratory slip."
        }
    )
    assert verify_resp.status_code == 200, verify_resp.text
    assert verify_resp.json()["status"] == "clinician_verified"