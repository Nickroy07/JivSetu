"""Development simulator: issue a card / QR payload for an existing patient WITHOUT hardware.

    python scripts/simulate_card.py <patient_id> [qr|rfid|nfc]

Paste the printed payload into the "Card code" box on /patient/scan. This is a simulation:
it writes a real token to the local database, so refuse to run in production.
"""
import hashlib
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models.patient_identifier import PatientIdentifier  # noqa: E402

if settings.is_production:
    sys.exit("Refusing to run the card simulator in production.")
if len(sys.argv) < 2 or not sys.argv[1].isdigit():
    sys.exit(__doc__)

raw = secrets.token_urlsafe(24)
with SessionLocal() as db:
    db.add(PatientIdentifier(patient_id=int(sys.argv[1]), kind=sys.argv[2] if len(sys.argv) > 2 else "rfid", token_hash=hashlib.sha256(raw.encode()).hexdigest()))
    db.commit()
print("SIMULATED card payload (development only):\nJSV1." + raw)
