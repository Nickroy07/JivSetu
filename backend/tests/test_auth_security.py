from app.db import SessionLocal
from app.models.hospital import Hospital
from init_db import create_staff
from tests.conftest import STAFF_PASSWORD, register_patient

ANSWERS = {"chief_complaint": "fever"}


def _login(client, user, password=STAFF_PASSWORD):
    r = client.post("/auth/login", data={"username": user, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _other_hospital_doctor():
    with SessionLocal() as db:
        h = db.query(Hospital).filter_by(hospital_code="OTHER-H").first()
        if not h:
            h = Hospital(hospital_code="OTHER-H", name="Other Synthetic Hospital")
            db.add(h)
            db.flush()
        create_staff(db, h, "other-doctor", "Dr. Other", "doctor", STAFF_PASSWORD)
        db.commit()


def test_logout_revokes_token(client):
    headers = _login(client, "test-doctor")
    assert client.get("/auth/me", headers=headers).status_code == 200
    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/auth/me", headers=headers).status_code == 401
    assert client.get("/doctor/queue", headers=headers).status_code == 401


def test_deactivated_user_loses_access(client):
    with SessionLocal() as db:
        from app.models.hospital import Hospital as H

        create_staff(db, db.query(H).first(), "temp-doctor", "Dr. Temp", "doctor", STAFF_PASSWORD)
        db.commit()
    headers = _login(client, "temp-doctor")
    assert client.get("/doctor/queue", headers=headers).status_code == 200
    with SessionLocal() as db:
        from app.models.user import User

        db.query(User).filter_by(user_code="temp-doctor").one().is_active = False
        db.commit()
    assert client.get("/doctor/queue", headers=headers).status_code == 401


def test_doctor_cannot_see_other_hospital_patient(client, patient, doctor_headers):
    _other_hospital_doctor()
    other = _login(client, "other-doctor")
    pid, vid = patient["patient_id"], patient["visit_id"]

    own = client.get(f"/doctor/patients/{pid}", headers=doctor_headers)
    assert own.status_code == 200
    assert client.get(f"/doctor/patients/{pid}", headers=other).status_code == 404
    assert client.get(f"/clinical-history/visits/{vid}", headers=other).status_code in (403, 404)
    assert client.get(f"/documents/patient/{pid}", headers=other).status_code == 404

    queue = client.get("/doctor/queue?scope=all", headers=other).json()
    assert queue["total"] == 0
    assert client.get("/doctor/overview", headers=other).json()["counts"]["in_queue"] == 0


def test_consent_required_then_recorded(client, patient):
    h, vid = patient["headers"], patient["visit_id"]
    blocked = client.post(f"/patient/visits/{vid}/start-interview", headers=h)
    assert blocked.status_code == 409

    bad = client.post("/patient/consent", headers=h, json={"visit_id": vid, "purposes": {"nonsense": True}})
    assert bad.status_code == 422

    ok = client.post("/patient/consent", headers=h, json={"visit_id": vid, "purposes": {"case_taking": True, "document_processing": True}, "language": "hi"})
    assert ok.status_code == 201
    assert ok.json()["consents"]["case_taking"] is True
    assert client.post(f"/patient/visits/{vid}/start-interview", headers=h).status_code == 200

    # Withdrawal is a new ledger row and takes effect immediately.
    client.post("/patient/consent", headers=h, json={"visit_id": vid, "purposes": {"case_taking": False}})
    assert client.get("/patient/consent", headers=h).json()["consents"]["case_taking"] is False


def test_other_patient_cannot_record_consent_for_visit(client, patient):
    intruder = register_patient(client, "9" + "123456780")
    r = client.post("/patient/consent", headers=intruder["headers"], json={"visit_id": patient["visit_id"], "purposes": {"case_taking": True}})
    assert r.status_code == 404
