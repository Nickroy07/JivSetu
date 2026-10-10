from app.db import SessionLocal
from app.models.hospital import Hospital
from init_db import create_staff
from tests.conftest import STAFF_PASSWORD, register_patient


def _admin_headers(client):
    with SessionLocal() as db:
        create_staff(db, db.query(Hospital).filter_by(hospital_code="JANSEVA-DH").first() or db.query(Hospital).first(), "test-admin", "Admin", "admin", STAFF_PASSWORD)
        db.commit()
    r = client.post("/auth/login", data={"username": "test-admin", "password": STAFF_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_admin_endpoints_denied_to_doctor_and_patient(client, doctor_headers, patient):
    for path in ("/admin/overview", "/admin/users", "/admin/audit", "/admin/hospital", "/admin/config"):
        assert client.get(path, headers=doctor_headers).status_code == 403, path
        assert client.get(path, headers=patient["headers"]).status_code == 403, path
        assert client.get(path).status_code == 401, path


def test_overview_reflects_real_data(client, patient):
    h = _admin_headers(client)
    before = client.get("/admin/overview", headers=h).json()["counts"]
    register_patient(client, "9" + "555000111")
    after = client.get("/admin/overview", headers=h).json()["counts"]
    assert after["patients"] == before["patients"] + 1
    assert after["visits"] == before["visits"] + 1
    assert client.get("/admin/overview", headers=h).json()["system"]["database"]["status"] == "ok"


def test_user_management_and_audit(client):
    h = _admin_headers(client)
    body = {"user_code": "new-doc", "full_name": "Dr. New", "role": "doctor", "password": "Synthetic-Pass-123"}
    created = client.post("/admin/users", headers=h, json=body)
    assert created.status_code == 201, created.text
    uid = created.json()["user"]["id"]
    assert client.post("/admin/users", headers=h, json=body).status_code == 409
    assert client.post("/admin/users", headers=h, json={**body, "user_code": "x1", "password": "short"}).status_code == 422

    assert any(u["user_code"] == "new-doc" for u in client.get("/admin/users?search=new-doc", headers=h).json()["items"])

    # New account can sign in; deactivating it ends access immediately.
    login = client.post("/auth/login", data={"username": "new-doc", "password": "Synthetic-Pass-123"})
    assert login.status_code == 200
    doc = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.patch(f"/admin/users/{uid}", headers=h, json={"is_active": False}).status_code == 200
    assert client.get("/doctor/queue", headers=doc).status_code == 401

    me = client.get("/auth/me", headers=h).json()
    own = client.get("/admin/users?search=test-admin", headers=h).json()["items"][0]["id"]
    assert client.patch(f"/admin/users/{own}", headers=h, json={"is_active": False}).status_code == 409

    actions = {a["action"] for a in client.get("/admin/audit", headers=h).json()["items"]}
    assert {"admin.user_created", "admin.user_updated"} <= actions
    assert me["role"] == "admin"


def test_audit_log_is_read_only(client):
    h = _admin_headers(client)
    for method in ("delete", "put", "patch", "post"):
        assert getattr(client, method)("/admin/audit", headers=h).status_code == 405


def test_hospital_update(client):
    h = _admin_headers(client)
    r = client.patch("/admin/hospital", headers=h, json={"name_mr": "चाचणी रुग्णालय"})
    assert r.status_code == 200 and r.json()["name_mr"] == "चाचणी रुग्णालय"
    assert "id" not in r.json()
