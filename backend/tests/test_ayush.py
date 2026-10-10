from app.services import ayush as defs
from tests.test_auth_security import _login, _other_hospital_doctor

ASHTAVIDHA = ["nadi", "mala", "mutra", "jihva", "shabda", "sparsha", "drik", "aakriti"]
DASHAVIDHA = ["prakriti", "vikriti", "sara", "samhanana", "pramana", "satmya", "satva", "ahara_shakti", "vyayama_shakti", "vaya"]


def test_all_specified_fields_exist_with_three_languages():
    assert defs.field_keys("ashtavidha") == ASHTAVIDHA
    assert defs.field_keys("dashavidha") == DASHAVIDHA
    assert {"darshana", "sparshana"} <= set(defs.field_keys("trividha")) and any(k.startswith("prashna") for k in defs.field_keys("trividha"))
    for m in defs.MODULES.values():
        assert set(m["title"]) == set(m["instructions"]) == {"en", "hi", "mr"}
        for f in m["fields"]:
            assert set(f["label"]) == {"en", "hi", "mr"} and all(f["label"].values())


def test_schema_hides_practitioner_fields_from_patients(client, patient, doctor_headers):
    p = client.get("/ayush/schema", headers=patient["headers"]).json()["modules"]
    assert "ashtavidha" not in p
    assert all(f["audience"] == "patient" for m in p.values() for f in m["fields"])
    d = client.get("/ayush/schema", headers=doctor_headers).json()["modules"]
    assert len(d["ashtavidha"]["fields"]) == 8 and len(d["dashavidha"]["fields"]) == 10


def test_patient_can_answer_only_patient_fields(client, patient):
    vid, h = patient["visit_id"], patient["headers"]
    ok = client.put(f"/ayush/visits/{vid}/trividha", headers=h, json={"values": {"prashna_sleep": "Light sleep, wakes at 3 am"}})
    assert ok.status_code == 200, ok.text
    assert ok.json()["assessment"]["sources"]["prashna_sleep"] == "patient"
    assert client.put(f"/ayush/visits/{vid}/trividha", headers=h, json={"values": {"darshana": "x"}}).status_code == 403
    assert client.put(f"/ayush/visits/{vid}/ashtavidha", headers=h, json={"values": {"nadi": "x"}}).status_code == 403
    assert client.put(f"/ayush/visits/{vid}/trividha", headers=h, json={"values": {"bogus": "x"}}).status_code == 422
    assert client.put(f"/ayush/visits/{vid}/trividha", headers=h, json={"values": {}, "verify": True}).status_code == 403
    assert client.put(f"/ayush/visits/{vid}/nonsense", headers=h, json={"values": {}}).status_code == 404
    view = client.get(f"/ayush/visits/{vid}", headers=h).json()["modules"]
    assert all(set(m["values"]) <= set(defs.field_keys(m["module"], "patient")) for m in view)


def test_other_patient_cannot_access_assessment(client, patient):
    from tests.conftest import register_patient

    intruder = register_patient(client, "9" + "246813570")
    assert client.get(f"/ayush/visits/{patient['visit_id']}", headers=intruder["headers"]).status_code == 404
    assert client.put(f"/ayush/visits/{patient['visit_id']}/trividha", headers=intruder["headers"], json={"values": {"prashna_sleep": "x"}}).status_code == 404


def test_practitioner_completes_verifies_and_edit_resets_review(client, patient, doctor_headers):
    vid = patient["visit_id"]
    url = f"/ayush/visits/{vid}/ashtavidha"
    partial = client.put(url, headers=doctor_headers, json={"values": {"nadi": "Vata gati"}})
    assert partial.json()["assessment"]["status"] == "incomplete"
    # Cannot verify an incomplete assessment.
    assert client.put(url, headers=doctor_headers, json={"values": {}, "verify": True}).status_code == 409

    full = {k: f"finding {k}" for k in ASHTAVIDHA}
    done = client.put(url, headers=doctor_headers, json={"values": full, "verify": True}).json()["assessment"]
    assert done["status"] == "completed" and done["review_status"] == "reviewed"
    assert done["reviewed_by"] == "test-doctor" and done["reviewed_at"]

    edited = client.put(url, headers=doctor_headers, json={"values": {"mala": "changed"}}).json()["assessment"]
    assert edited["review_status"] == "unreviewed" and edited["reviewed_at"] is None
    assert edited["sources"]["mala"] == "practitioner"

    # Content is bound to the visit and patient.
    assert client.get(f"/ayush/visits/{vid}", headers=doctor_headers).json()["modules"][1]["values"]["mala"] == "changed"


def test_admin_cannot_verify_and_other_hospital_blocked(client, patient, doctor_headers):
    from tests.test_admin import _admin_headers

    vid = patient["visit_id"]
    admin = _admin_headers(client)
    full = {k: "x" for k in ASHTAVIDHA}
    assert client.put(f"/ayush/visits/{vid}/ashtavidha", headers=admin, json={"values": full, "verify": True}).status_code == 403
    _other_hospital_doctor()
    other = _login(client, "other-doctor")
    assert client.get(f"/ayush/visits/{vid}", headers=other).status_code == 404
    assert client.put(f"/ayush/visits/{vid}/ashtavidha", headers=other, json={"values": {"nadi": "x"}}).status_code == 404
    assert client.get(f"/ayush/visits/{vid}", headers=doctor_headers).status_code == 200


def test_oversized_answer_rejected(client, patient):
    r = client.put(f"/ayush/visits/{patient['visit_id']}/trividha", headers=patient["headers"], json={"values": {"prashna_sleep": "x" * 1001}})
    assert r.status_code == 422
