"""
Create the Jivsetu schema and seed reference data.

    python init_db.py                      # tables + default hospital
    python init_db.py --staff doctor-01 --name "Dr. A. Rao" --role doctor
                                           # create a staff account (prompts for password)
    python init_db.py --demo               # DEMO_MODE only: synthetic, clearly labelled records

Safe to run repeatedly. Works with MySQL or PostgreSQL (production) and SQLite (local dev).
"""

import argparse
import getpass
import secrets
import sys
from datetime import date

import app.models  # noqa: F401
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.models import (
    ClinicalDocumentExtraction,
    ClinicalHistory,
    Doctor,
    Hospital,
    MedicalDocument,
    Patient,
    PatientVisit,
    User,
)
from app.security import hash_password
from app.services.case_summary import build_case_summary, evaluate_red_flags

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

    # 1. Asha Patil (ACS / Emergency Chest Pain)
    # 2. Ramesh Sharma (Diabetes Range: HbA1c 7.8% & FPG 164 mg/dL)
    # 3. Sunita Deshmukh (Prediabetes Range: HbA1c 6.0% & FPG 108 mg/dL)
    # 4. Ravi Kulkarni (Dengue Fever / Platelet 85,000)
    # 5. Meena Joshi (Waiting for Interview / AYUSH)
    samples = [
        ("Asha Patil", "9000000001", {
            "chief_complaint": "chest_pain",
            "chest_pain_onset": "Since 2 hours ago",
            "chest_pain_severity": "severe",
            "chest_pain_radiation": "left_arm",
            "breathlessness": "yes",
            "sweating": "yes",
            "nausea": "no",
            "diabetes": "no",
            "medications": "none",
            "allergies": "none"
        }, None),

        ("Ramesh Sharma", "9000000002", {
            "chief_complaint": "follow_up",
            "symptom_onset": "Known diabetic for 3 years",
            "diabetes": "yes",
            "medications": "Tab Metformin 500 mg BD",
            "allergies": "none",
            "family_history": "Father had Type 2 Diabetes"
        }, {
            "doc_type": "lab_report",
            "filename": "diabetes_panel_ramesh.pdf",
            "data": {
                "document_type": "lab_report",
                "document_date": "2026-03-10",
                "patient_name": "Ramesh Sharma",
                "doctor_name": "Dr. V. K. Mehta",
                "hospital_name": "Janseva District Hospital Lab",
                "diagnoses_mentioned": ["Type 2 Diabetes Mellitus"],
                "medications": [{"name": "Metformin", "strength": "500 mg", "frequency": "BD", "source_text": "Tab Metformin 500 mg BD"}],
                "lab_values": [
                    {"test_name": "HbA1c", "value": "7.8", "unit": "%", "source_text": "HbA1c: 7.8 %"},
                    {"test_name": "Fasting Plasma Glucose", "value": "164", "unit": "mg/dL", "source_text": "Fasting Glucose: 164 mg/dL"}
                ]
            }
        }),

        ("Sunita Deshmukh", "9000000003", {
            "chief_complaint": "follow_up",
            "symptom_onset": "Routine health checkup",
            "diabetes": "no",
            "medications": "none",
            "allergies": "none"
        }, {
            "doc_type": "lab_report",
            "filename": "routine_checkup_sunita.pdf",
            "data": {
                "document_type": "lab_report",
                "document_date": "2026-03-12",
                "patient_name": "Sunita Deshmukh",
                "doctor_name": "Dr. S. Patil",
                "hospital_name": "Janseva District Hospital Lab",
                "diagnoses_mentioned": [],
                "medications": [],
                "lab_values": [
                    {"test_name": "HbA1c", "value": "6.0", "unit": "%", "source_text": "HbA1c: 6.0 %"},
                    {"test_name": "Fasting Glucose", "value": "108", "unit": "mg/dL", "source_text": "Fasting Glucose: 108 mg/dL"}
                ]
            }
        }),

        ("Ravi Kulkarni", "9000000004", {
            "chief_complaint": "fever",
            "symptom_onset": "Fever with chills for 4 days",
            "breathlessness": "no",
            "sweating": "yes",
            "diabetes": "no",
            "medications": "Paracetamol 650 mg SOS",
            "allergies": "Penicillin"
        }, {
            "doc_type": "lab_report",
            "filename": "dengue_panel_ravi.pdf",
            "data": {
                "document_type": "lab_report",
                "document_date": "2026-03-14",
                "patient_name": "Ravi Kulkarni",
                "doctor_name": "Dr. A. Rao",
                "hospital_name": "Janseva District Hospital Lab",
                "diagnoses_mentioned": ["Acute Febrile Illness"],
                "medications": [],
                "lab_values": [
                    {"test_name": "Platelet Count", "value": "85000", "unit": "/µL", "source_text": "Platelet Count: 85,000 /µL"},
                    {"test_name": "Dengue NS1 Ag", "value": "Positive", "unit": "", "source_text": "Dengue NS1 Antigen: Positive"}
                ]
            }
        }),

        ("Meena Joshi", "9000000005", None, None),
    ]

    for name, mobile, answers, doc_spec in samples:
        if db.query(Patient).filter_by(mobile=mobile).first():
            continue
        user = User(user_code=f"patient-{mobile}", role="patient", hospital_id=hospital.id)
        db.add(user)
        db.flush()
        patient = Patient(user_id=user.id, full_name=f"{DEMO_PREFIX}{name}", mobile=mobile)
        db.add(patient)
        db.flush()
        visit = PatientVisit(
            patient_id=patient.id,
            hospital_id=hospital.id,
            visit_date=date.today(),
            status="ready_for_review" if answers else "waiting",
            chief_complaint=(answers or {}).get("chief_complaint"),
        )
        db.add(visit)
        db.flush()

        docs_for_summary = []
        if doc_spec:
            doc = MedicalDocument(
                patient_id=patient.id,
                visit_id=visit.id,
                document_type=doc_spec["doc_type"],
                original_filename=doc_spec["filename"],
                stored_filename=f"demo_{doc_spec['filename']}",
                file_path=f"storage/demo_{doc_spec['filename']}",
                mime_type="application/pdf",
                file_size=10240,
                upload_status="processed",
                ocr_status="completed",
                extraction_method="pdf_text"
            )
            db.add(doc)
            db.flush()
            ext = ClinicalDocumentExtraction(
                document_id=doc.id,
                extraction_status="completed",
                extracted_data=doc_spec["data"],
                confidence=95.0,
                fields_found=len(doc_spec["data"].get("lab_values", [])) + len(doc_spec["data"].get("medications", []))
            )
            db.add(ext)
            db.flush()
            docs_for_summary.append({
                "id": doc.id,
                "filename": doc.original_filename,
                "document_type": doc.document_type,
                "extraction": {"data": doc_spec["data"], "reviewed_data": None}
            })

        if answers:
            red_flags = evaluate_red_flags(answers)
            summary = build_case_summary(answers, red_flags, docs_for_summary)
            db.add(ClinicalHistory(
                visit_id=visit.id,
                patient_id=patient.id,
                chief_complaint=answers.get("chief_complaint"),
                history_data=answers,
                red_flags=red_flags,
                physician_status="pending",
                ai_summary=summary
            ))

    print("Synthetic demo patients created with source-linked documents and clinical reconciliation data.")


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
