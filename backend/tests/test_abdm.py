import pytest

from app.config import settings
from app.services import abdm
from tests.conftest import register_patient
from tests.test_auth_security import _login, _other_hospital_doctor

NUMBER = "12-3456-7890-1234"


def _setup(client, doctor_headers, patient):
    return client.put(f"/abdm/patients/{patient['patient_id']}/abha", headers=doctor_headers, json={"abha_number": NUMBER, "abha_address": "synthetic.user@abdm"})


def test_status_never_claims_live_exchange(client, doctor_headers):
    s = client.get("/abdm/status", headers=doctor_headers).json()
    assert s["live_exchange_available"] is False and s["pending"]


def test_abha_validation_masking_and_never_verified_by_mock(client, doctor_headers, patient):
    pid = patient["patient_id"]
    assert client.put(f"/abdm/patients/{pid}/abha", headers=doctor_headers, json={"abha_number": "1234"}).status_code == 422
    assert client.put(f"/abdm/patients/{pid}/abha", headers=doctor_headers, json={"abha_number": NUMBER, "abha_address": "bad address"}).status_code == 422
    ok = _setup(client, doctor_headers, patient).json()
    assert ok["abha_number"] == "XX-XXXX-XXXX-1234" and ok["verified"] is False
    assert "12345678901234" not in str(client.get(f"/abdm/patients/{pid}/abha", headers=doctor_headers).json())
    v = client.post(f"/abdm/patients/{pid}/abha/verify", headers=doctor_headers).json()
    assert v["mock"] is True and v["abha"]["verified"] is False and v["abha"]["verification_source"] == "none"


def test_share_requires_abha_and_patient_consent_and_is_mock(client, doctor_headers, patient):
    vid = patient["visit_id"]
    assert client.post(f"/abdm/visits/{vid}/share", headers=doctor_headers).status_code == 409  # no ABHA
    _setup(client, doctor_headers, patient)
    assert client.post(f"/abdm/visits/{vid}/share", headers=doctor_headers).status_code == 409  # no consent
    consent = client.post("/patient/consent", headers=patient["headers"], json={"visit_id": vid, "purposes": {"abdm_sharing": True}})
    assert consent.status_code == 201
    r = client.post(f"/abdm/visits/{vid}/share", headers=doctor_headers)
    assert r.status_code == 200, r.text
    assert r.json()["mock"] is True and r.json()["sent_to_abdm"] is False and r.json()["resource_count"] > 0
    # Withdrawing consent blocks sharing again.
    client.post("/patient/consent", headers=patient["headers"], json={"visit_id": vid, "purposes": {"abdm_sharing": False}})
    assert client.post(f"/abdm/visits/{vid}/share", headers=doctor_headers).status_code == 409


def test_disabled_and_sandbox_modes(client, doctor_headers, patient, monkeypatch):
    _setup(client, doctor_headers, patient)
    client.post("/patient/consent", headers=patient["headers"], json={"visit_id": patient["visit_id"], "purposes": {"abdm_sharing": True}})
    url = f"/abdm/visits/{patient['visit_id']}/share"
    monkeypatch.setattr(settings, "abdm_mode", "disabled")
    assert client.post(url, headers=doctor_headers).status_code == 503
    monkeypatch.setattr(settings, "abdm_mode", "sandbox")
    assert client.post(url, headers=doctor_headers).status_code == 501  # live exchange is pending


def test_mock_mode_rejected_in_production(monkeypatch):
    monkeypatch.setattr(settings, "abdm_mode", "mock")
    monkeypatch.setattr(settings, "environment", "production")
    assert any("ABDM_MODE=mock" in p for p in settings.validate_for_runtime())
    with pytest.raises(abdm.AbdmUnavailable):
        abdm.get_adapter()


def test_access_control(client, doctor_headers, patient):
    pid = patient["patient_id"]
    assert client.get(f"/abdm/patients/{pid}/abha").status_code == 401
    assert client.get(f"/abdm/patients/{pid}/abha", headers=patient["headers"]).status_code == 403
    _other_hospital_doctor()
    other = _login(client, "other-doctor")
    assert client.get(f"/abdm/patients/{pid}/abha", headers=other).status_code == 404
    assert client.post(f"/abdm/visits/{patient['visit_id']}/share", headers=other).status_code == 404
