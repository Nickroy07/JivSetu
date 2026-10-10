# Jivsetu AI — API

FastAPI backend: staff auth (Argon2 + JWT), patient OTP sign-in, guided case-taking,
document upload and extraction, draft clinical history and clinician review.

Full setup, environment variables and deployment steps: see `../README.md`.

Quick start (local):

```bash
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env            # set JWT_SECRET_KEY and DATABASE_URL
python init_db.py               # add --demo (with DEMO_MODE=true) for synthetic [DEMO] data
uvicorn app.main:app --host 127.0.0.1 --port 8001
python -m pytest -q
```

There are no built-in default accounts. Create staff with
`python init_db.py --staff <id> --name "<name>"`; the demo seed prints a one-time
random password for `demo-doctor`.
