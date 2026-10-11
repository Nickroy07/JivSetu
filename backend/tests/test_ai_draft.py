import json

import httpx
import pytest

from app.config import settings
from app.services import ai_summary
from tests.test_api import submit_history

GOOD = {"summary": "Chest pain for two hours.", "patient_reported": ["Severe chest pain"],
        "from_documents": [], "unclear_or_missing": ["Family history"]}


@pytest.fixture()
def ai_on(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")
    monkeypatch.setattr(settings, "openrouter_model", "test/model")


def fake_post(status=200, content=None, raises=None, seen=None):
    def _post(url, headers=None, json=None, timeout=None):
        if seen is not None:
            seen.append(json)
        if raises:
            raise raises
        body = {"choices": [{"message": {"content": content if content is not None else ""}}]}
        return httpx.Response(status, json=body)
    return _post


def test_parse_rejects_garbage_and_accepts_fenced_json():
    with pytest.raises(ai_summary.AiError):
        ai_summary.parse_draft("not json")
    with pytest.raises(ai_summary.AiError):
        ai_summary.parse_draft(json.dumps({"summary": 5}))
    assert ai_summary.parse_draft("```json\n" + json.dumps(GOOD) + "\n```").summary.startswith("Chest")


def test_payload_has_no_identity_fields():
    payload = ai_summary.build_payload({"chief_complaint": "fever"}, {"medications": [{"name": "X", "source": {"filename": "secret.pdf"}}]})
    assert "secret.pdf" not in json.dumps(payload)


def test_disabled_by_default(client, doctor_headers, patient):
    submit_history(client, patient)
    r = client.post(f"/clinical-history/visits/{patient['visit_id']}/ai-draft", headers=doctor_headers)
    assert r.status_code == 503


def test_patient_cannot_request_ai_draft(client, patient, ai_on):
    submit_history(client, patient)
    r = client.post(f"/clinical-history/visits/{patient['visit_id']}/ai-draft", headers=patient["headers"])
    assert r.status_code in (401, 403)


def test_success_is_unapproved_draft_and_sends_no_name(client, doctor_headers, patient, ai_on, monkeypatch):
    submit_history(client, patient)
    seen: list = []
    monkeypatch.setattr(httpx, "post", fake_post(content=json.dumps(GOOD), seen=seen))
    r = client.post(f"/clinical-history/visits/{patient['visit_id']}/ai-draft", headers=doctor_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "unapproved_draft"
    assert "Synthetic Patient" not in json.dumps(seen)


@pytest.mark.parametrize("kwargs", [
    {"status": 429}, {"status": 500}, {"content": "garbage"},
    {"raises": httpx.ConnectTimeout("t")},
])
def test_provider_failures_return_502(client, doctor_headers, patient, ai_on, monkeypatch, kwargs):
    submit_history(client, patient)
    monkeypatch.setattr(httpx, "post", fake_post(**kwargs))
    r = client.post(f"/clinical-history/visits/{patient['visit_id']}/ai-draft", headers=doctor_headers)
    assert r.status_code == 502
    assert "test-key" not in r.text
