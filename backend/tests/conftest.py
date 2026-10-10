import os
import random
import tempfile
from pathlib import Path

import pytest

_tmp = Path(tempfile.mkdtemp(prefix="jivsetu-test-"))
os.environ.update(
    ENVIRONMENT="test",
    JWT_SECRET_KEY="test-secret-" + "x" * 40,
    DATABASE_URL=f"sqlite:///{(_tmp / 'test.db').as_posix()}",
    DOCUMENT_STORAGE_PATH=str(_tmp / "docs"),
    OTP_PROVIDER="dev",
    DEMO_MODE="false",
)

from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from init_db import create_staff, ensure_hospital  # noqa: E402

STAFF_PASSWORD = "Synthetic-Pass-123"


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        hospital = ensure_hospital(db)
        create_staff(db, hospital, "test-doctor", "Dr. Synthetic", "doctor", STAFF_PASSWORD)
        db.commit()
    yield


@pytest.fixture()
def client():
    from app import ratelimit
    ratelimit.reset()
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def doctor_headers(client):
    r = client.post("/auth/login", data={"username": "test-doctor", "password": STAFF_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def register_patient(client, mobile: str, name: str = "Synthetic Patient"):
    sent = client.post("/auth/patient/send-otp", json={"mobile": mobile})
    assert sent.status_code == 200, sent.text
    code = sent.json()["dev_otp"]
    r = client.post("/auth/patient/verify-otp", json={"mobile": mobile, "otp": code, "name": name})
    assert r.status_code == 200, r.text
    body = r.json()
    body["headers"] = {"Authorization": f"Bearer {body['access_token']}"}
    return body


@pytest.fixture()
def patient(client):
    return register_patient(client, f"9{random.randint(100000000, 999999999)}")
