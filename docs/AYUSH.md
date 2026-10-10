# AYUSH assessment module

Structured documentation for three classical examination frameworks. It records what a patient or
practitioner reports; it does **not** score, rank or diagnose. No Ayurvedic scoring method has been
clinically validated for JivSetu, so none is implemented.

| Module | Fields | Who answers |
|---|---|---|
| Trividha Pariksha | Darshana, Sparshana (practitioner); Prashna — complaints, appetite/digestion, sleep, bowel, urine, thirst/energy (patient) | split |
| Ashtavidha Pariksha | Nadi, Mala, Mutra, Jihva, Shabda, Sparsha, Drik, Aakriti | practitioner |
| Dashavidha Pariksha | Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Satva, Vaya (practitioner); Ahara Shakti, Vyayama Shakti (patient) | split |

Labels and instructions are in English, Hindi and Marathi (`backend/app/services/ayush.py`).
Prakriti / Vikriti show Vata, Pitta, Kapha and combinations as **optional suggestions** only.
Wording of the Hindi and Marathi labels should be reviewed by a qualified Ayurvedic practitioner.

## API

| Endpoint | Access |
|---|---|
| `GET /ayush/schema` | any signed-in user; patients receive only patient-facing fields |
| `GET /ayush/visits/{visit_id}` | the visit's patient, or staff of the visit's hospital |
| `PUT /ayush/visits/{visit_id}/{module}` body `{values, verify}` | patients: patient fields only (403 otherwise); doctors/admins: all fields; **only doctors may verify** |

## Rules

- Stored per visit and module (`ayush_assessments`, unique on visit + module) and bound to the patient and hospital.
- Each field remembers who wrote it (`patient` / `practitioner`); an edit trail (who, when, which fields — no values) is kept.
- Status: **incomplete** until every field is filled, then **completed**. Verifying requires completed and records the reviewing doctor and time.
- Editing a verified assessment resets it to unverified.
- Audit events: `ayush.updated`, `ayush.verified` (field names only, never answers).

UI: patients reach it from the confirmation page (optional); doctors see it on the case review page.
Upgrade an existing database with `sql/08_upgrade_ayush.sql` or `python init_db.py`.
