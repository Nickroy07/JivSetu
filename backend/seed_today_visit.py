from datetime import date
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.patient import Patient
from app.models.patient_visit import PatientVisit

from app.db import SessionLocal

# Import models so SQLAlchemy registers their tables
from app.models.hospital import Hospital
def seed_today_visit():
    db: Session = SessionLocal()
    try:
        patient = db.query(Patient).order_by(Patient.id.asc()).first()
        if not patient:
            print("No patient exists. Create a patient first.")
            return

        existing = (
            db.query(PatientVisit)
            .filter(
                PatientVisit.patient_id == patient.id,
                PatientVisit.visit_date == date.today(),
            )
            .first()
        )

        if existing:
            print(f"Today's visit already exists: {existing.id}")
            return

        visit = PatientVisit(
            patient_id=patient.id,
            hospital_id=1,
            visit_date=date.today(),
            status="ready_for_review",
            chief_complaint="Chest pain",
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)
        print(f"Today's visit created: {visit.id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_today_visit()
