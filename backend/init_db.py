"""
Create the Jivsetu schema and seed reference data.

    python init_db.py                      # tables + default hospital
    python init_db.py --staff doctor-01 --name "Dr. A. Rao" --role doctor
                                           # create a staff account (prompts for password)
    python init_db.py --demo               # DEMO_MODE only: synthetic, clearly labelled records

Safe to run repeatedly. Works with MySQL (production) and SQLite (local dev).
For an existing MySQL database created from the old sql/ scripts, apply
sql/06_upgrade_v1.sql first.
"""

import argparse
import getpass
import secrets
import sys
from datetime import date

import app.models  # noqa: F401
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.models import ClinicalHistory, Doctor, Hospital, Patient, PatientVisit, User
from app.security import hash_password
from app.services.case_summary import build_case_summary

DEMO_PREFIX = "[DEMO] "


def ensure_hospital(db) -> Hospital:
    hospital = db.query(Hospital).filter_by(hospital_code=settings.default_hospital_code).first()
    if not hospital:
        hospital = Hospital(
            hospital_code=settings.default_hospital_code,
            name="Janseva District Government Hospital",
            name_hi="जनसेवा जिला सरकारी अस्पताल",
            name_mr="जनसेवा जिल्हा सरकारी रुग्णालय",
        )
        db.add(hospital)
        db.flush()
    return hospital


def create_staff(db, hospital, user_code: str, full_name: str, role: str, password: str) -> bool:
    if db.query(User).filter_by(user_code=user_code).first():
        print(f"Staff account '{user_code}' already exists; skipped.")
        return False
    if len(password) < 10:
        sys.exit("Password must be at least 10 characters.")
    user = User(user_code=user_code, password_hash=hash_password(password), role=role, hospital_id=hospital.id)
    db.add(user)
    db.flush()
    if role == "doctor":
        db.add(Doctor(user_id=user.id, full_name=full_name, hospital_id=hospital.id))
    return True


def seed_demo(db, hospital) -> None:
    if not settings.demo_mode:
        sys.exit("Refusing to seed demo data: set DEMO_MODE=true (never in production).")

    password = secrets.token_urlsafe(9)
    if create_staff(db, hospital, "demo-doctor", f"{DEMO_PREFIX}Demo Clinician", "doctor", password):
        print(f"Demo doctor login -> ID: demo-doctor  Password: {password}  (shown once)")

    samples = [
        ("Asha Patil", "9000000001", {"chief_complaint": "chest_pain", "chest_pain_onset": "Since this morning",
                                       "chest_pain_severity": "severe", "breathlessness": "yes", "sweating": "yes",
                                       "nausea": "no", "diabetes": "no", "medications": "none", "allergies": "none"}),
        ("Ravi Kulkarni", "9000000002", {"chief_complaint": "fever", "diabetes": "yes", "medications": "Metformin 500 mg",
                                          "allergies": "Penicillin", "family_history": "Father had hypertension"}),
        ("Meena Joshi", "9000000003", None),
    ]
    for name, mobile, answers in samples:
        if db.query(Patient).filter_by(mobile=mobile).first():
            continue
        user = User(user_code=f"patient-{mobile}", role="patient", hospital_id=hospital.id)
        db.add(user)
        db.flush()
        patient = Patient(user_id=user.id, full_name=f"{DEMO_PREFIX}{name}", mobile=mobile)
        db.add(patient)
        db.flush()
        visit = PatientVisit(patient_id=patient.id, hospital_id=hospital.id, visit_date=date.today(),
                             status="ready_for_review" if answers else "waiting",
                             chief_complaint=(answers or {}).get("chief_complaint"))
        db.add(visit)
        db.flush()
        if answers:
            db.add(ClinicalHistory(visit_id=visit.id, patient_id=patient.id, chief_complaint=answers["chief_complaint"],
                                   history_data=answers, red_flags=[], physician_status="pending",
                                   ai_summary=build_case_summary(answers, [], [])))
    print("Synthetic demo patients created (names prefixed with [DEMO]).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--staff", metavar="USER_ID")
    parser.add_argument("--name", default="")
    parser.add_argument("--role", choices=["doctor", "admin"], default="doctor")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    print(f"Schema ready on {settings.database_backend}.")

    with SessionLocal() as db:
        hospital = ensure_hospital(db)
        if args.staff:
            password = getpass.getpass(f"Password for {args.staff}: ")
            if create_staff(db, hospital, args.staff, args.name or args.staff, args.role, password):
                print(f"Staff account '{args.staff}' created.")
        if args.demo:
            seed_demo(db, hospital)
        db.commit()


if __name__ == "__main__":
    main()
