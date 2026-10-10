import random

from tests.conftest import register_patient
from tests.test_auth_security import _login, _other_hospital_doctor


def _issue(client, doctor_headers, pid, kind="rfid"):
    r = client.post("/identifiers", headers=doctor_headers, json={"patient_id": pid, "kind": kind})
    assert r.status_code == 201, r.text
    return r.json()


def _mobile():
    return f"9{random.randint(100000000, 999999999)}"


def test_card_signin_still_requires_otp_and_returns_no_patient_data(client, doctor_headers):
    p = register_patient(client, _mobile(), "Card Patient")
    card = _issue(client, doctor_headers, p["patient_id"])
    assert card["payload"].startswith("JSV1.") and "token_hash" not in card

    scan = client.post("/identifiers/scan", json={"token": card["payload"]})
    assert scan.status_code == 200, scan.text
    body = scan.json()
    assert body["masked_mobile"].startswith("******") and p["mobile"] not in str(body)
    assert "access_token" not in body and "patient_id" not in body  # scan alone grants nothing

    bad = client.post("/identifiers/verify", json={"token": card["payload"], "otp": "000000"})
    assert bad.status_code == 400
    ok = client.post("/identifiers/verify", json={"token": card["payload"], "otp": body["dev_otp"]})
    assert ok.status_code == 200, ok.text
    assert ok.json()["patient_id"] == p["patient_id"] and ok.json()["access_token"]
    # The session behaves like a normal patient session.
    me = client.get("/patient/me", headers={"Authorization": f"Bearer {ok.json()['access_token']}"})
    assert me.json()["patient"]["full_name"] == "Card Patient"


def test_unknown_and_deactivated_cards_do_not_resolve(client, doctor_headers):
    assert client.post("/identifiers/scan", json={"token": "JSV1.not-a-real-token-xxxxxxxx"}).status_code == 404
    p = register_patient(client, _mobile())
    card = _issue(client, doctor_headers, p["patient_id"], "qr")
    assert client.delete(f"/identifiers/{card['id']}", headers=doctor_headers).status_code == 204
    assert client.post("/identifiers/scan", json={"token": card["payload"]}).status_code == 404
    items = client.get(f"/identifiers/patient/{p['patient_id']}", headers=doctor_headers).json()["items"]
    assert items[0]["is_active"] is False and "payload" not in items[0]


def test_token_cannot_be_used_for_another_patient(client, doctor_headers):
    a, b = register_patient(client, _mobile(), "Patient A"), register_patient(client, _mobile(), "Patient B")
    card_a = _issue(client, doctor_headers, a["patient_id"])
    code = client.post("/identifiers/scan", json={"token": card_a["payload"]}).json()["dev_otp"]
    r = client.post("/identifiers/verify", json={"token": card_a["payload"], "otp": code}).json()
    assert r["patient_id"] == a["patient_id"] != b["patient_id"]


def test_only_authorised_staff_can_issue(client, patient, doctor_headers):
    assert client.post("/identifiers", json={"patient_id": patient["patient_id"], "kind": "qr"}).status_code == 401
    assert client.post("/identifiers", headers=patient["headers"], json={"patient_id": patient["patient_id"], "kind": "qr"}).status_code == 403
    assert client.post("/identifiers", headers=doctor_headers, json={"patient_id": patient["patient_id"], "kind": "magic"}).status_code == 422
    _other_hospital_doctor()
    other = _login(client, "other-doctor")
    assert client.post("/identifiers", headers=other, json={"patient_id": patient["patient_id"], "kind": "qr"}).status_code == 404


def test_scan_is_rate_limited(client):
    codes = [client.post("/identifiers/scan", json={"token": f"JSV1.guess-{i}-xxxxxxxx"}).status_code for i in range(12)]
    assert codes[:10] == [404] * 10 and codes[10] == 429
