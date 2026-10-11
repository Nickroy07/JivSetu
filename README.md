# Jivsetu MediKiosk

**AI-Assisted Multilingual Patient Case-Taking & Clinical Evidence Reconciliation Platform**

> *"AI prepares the clinical history; the physician makes the clinical decision."*

Jivsetu MediKiosk bridges the patient-facing clinical history bottleneck in busy outpatient departments (OPDs) and district government hospitals. It collects multilingual patient-reported history, digitizes uploaded medical documents, extracts structured lab and prescription data, reconciles evidence across sources, highlights missing or conflicting clinical information, flags urgent safety risks, supports traditional Ayurveda (AYUSH) assessments, and produces a review-ready record for clinician verification.

---

## Core Differentiator

**“Jivsetu connects the patient's story with the medical evidence, highlights what is missing or inconsistent, and gives clinicians a source-linked, review-ready clinical history.”**

Instead of relying on unvalidated AI diagnosis or black-box LLM output, Jivsetu uses a **hybrid deterministic rules engine**:
1. **Source Attribution:** Every extracted clinical claim retains its source tag (`patient_interview` or `document`), filename, and location.
2. **Clinical Criteria Reconciliation:** Laboratory values are compared against cited clinical guidelines (e.g. ADA 2026 HbA1c criteria, ACC/AHA ACS guidelines, NVBDCP/WHO Dengue guidelines).
3. **Prediabetes vs. Diabetes Distinction:** Values in prediabetes range (e.g., HbA1c 5.7%–6.4%) are explicitly distinguished from diabetes range (HbA1c >= 6.5%) and are never mislabelled as confirmed disease.
4. **Independent Emergency Triage:** Red-flag screening rules run instantly on patient answers regardless of OCR completion, LLM status, or missing documents.
5. **Clinician Control:** The physician retains sole authority to accept, amend, or return the draft clinical history.

---

## Key Features & Capabilities

### 1. Patient Experience
- **Multilingual Support:** English, Hindi (हिन्दी), and Marathi (मराठी) interface with voice read-aloud and speech-to-text.
- **Adaptive Interview:** Branching questions based on chief complaint (Chest pain, Fever, Breathing difficulty, etc.).
- **Voice & Touch Input:** High-contrast, touch-friendly UI for hospital kiosks, phones, and tablets.
- **Document Digestion:** Upload prescriptions, blood/lab reports, discharge summaries, X-ray/MRI reports, and handwritten notes.
- **Consent Ledger:** Patient consent captured and logged before case-taking or data sharing.

### 2. Clinician Workspace & Review
- **Real Queue Management:** Filter by hospital, status (`ready_for_review`, `waiting`, `completed`), date, and red-flag urgency.
- **Side-by-Side Review:** Inspect patient-reported vs. clinician-confirmed values next to original uploaded source documents.
- **Conflict & Missing Info Detection:** Highlights discrepancies (e.g., patient reported no diabetes, but prescription lists Metformin).
- **Physician Decisions:** Accept, Amend, or Return history with mandatory notes on rejection and optimistic concurrency protection.
- **FHIR R4 Export:** Download complete FHIR R4 JSON bundles containing Patient, Encounter, Condition, Observation, and DocumentReference resources.

### 3. AYUSH / Ayurveda Assessment
- **Trividha Pariksha:** Darshana (Observation), Sparshana (Touch/Palpation), Prashna (Questioning).
- **Ashtavidha Pariksha:** Nadi, Mala, Mutra, Jihva, Shabda, Sparsha, Drik, Aakriti.
- **Dashavidha Pariksha:** Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Satva, Ahara Shakti, Vyayama Shakti, Vaya.
- **Separate AYUSH Record:** Stored independently from biomedical history without generating automated drug prescriptions.

### 4. Interoperability & Identity
- **ABDM Readiness:** ABDM mock & sandbox adapter supporting ABHA verification and Care Context publishing.
- **QR / Card Scan Identification:** Rapid patient identification flow with mandatory OTP session re-verification.
- **Admin Dashboard:** Live DB metrics, staff account management, hospital settings, and read-only security audit log.

---

## Architecture & Technology Stack

| Tier | Stack | Directory |
|---|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Lucide Icons | `./` |
| **Backend API** | Python 3.12+, FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT, Argon2 (pwdlib) | `backend/` |
| **Database** | MySQL 8 (Production) or SQLite (Local Development) | `sql/`, `backend/init_db.py` |
| **Document OCR** | Native text-layer PDF extraction (`pypdf`), optional PaddleOCR engine for images | `backend/app/services/` |
| **Interoperability** | HL7® FHIR® R4 Bundle builder (`fhir.resources`), ABDM adapter | `backend/app/services/fhir.py` |

```
Patient (Mobile/Kiosk) ──► Next.js Frontend (Port 3000) ──► FastAPI API (Port 8001) ──► MySQL / SQLite
                                                              │
                                                              ├─► Controlled Document Storage
                                                              ├─► Hybrid Clinical Reconciliation Engine
                                                              └─► FHIR R4 / ABDM Adapter
```

---

## Demonstration Scenarios (Synthetic Data)

Run `python init_db.py --demo` (with `DEMO_MODE=true`) to generate synthetic records (`[DEMO]` prefix):

1. **Scenario 1 — Diabetes Evidence Reconciliation (Ramesh Sharma):**
   - Interview reports past diabetes and Metformin use.
   - Uploaded lab report shows **HbA1c 7.8%** and **Fasting Glucose 164 mg/dL**.
   - Reconciliation Engine evaluates ADA >= 6.5% criteria and flags Diabetes Range consideration with cited guideline.

2. **Scenario 2 — Prediabetes Range Evaluation (Sunita Deshmukh):**
   - Interview reports no diabetes.
   - Uploaded report shows **HbA1c 6.0%** and **Fasting Glucose 108 mg/dL**.
   - Reconciliation Engine evaluates ADA 5.7%–6.4% criteria and flags **Prediabetes Range**, explicitly confirming it is NOT diabetes.

3. **Scenario 3 — Emergency ACS Triage (Asha Patil):**
   - Patient reports severe chest pain radiating to left arm with sweating and breathlessness.
   - Red-Flag engine fires immediate urgent screening alerts independently of OCR or LLM status.

4. **Scenario 4 — Dengue Warning Signs (Ravi Kulkarni):**
   - Patient reports fever for 4 days.
   - Lab report contains **Platelet Count 85,000 /µL** (< 100,000 threshold) and **Dengue NS1 Positive**.
   - Engine flags warning threshold per NVBDCP / WHO Dengue guidelines.

5. **Scenario 5 — AYUSH / Ayurveda Assessment (Meena Joshi):**
   - Clinician completes Trividha, Ashtavidha, and Dashavidha forms with multilingual terminology support.

---

## 3-Minute Hackathon Presentation Walkthrough

1. **[0:00 - 0:45] Patient Case-Taking (Kiosk / Mobile):**
   - Select Hindi/Marathi, review privacy consent, start guided interview.
   - Speak or tap answers for chief complaint (e.g. chest pain or fever).
   - See red-flag emergency alert fire immediately if urgent symptoms are selected.
   - Upload a sample lab report or prescription.

2. **[0:45 - 1:45] Clinical Evidence Reconciliation:**
   - Sign in as `demo-doctor` and open the patient queue.
   - Open case review for **Ramesh Sharma** or **Sunita Deshmukh**.
   - Show side-by-side view: Patient answers vs. Extracted lab values.
   - Highlight the **Diabetes vs. Prediabetes Range** rule card with cited ADA guidelines and document source tags.
   - Point out missing information and conflicting entries (e.g., reported no diabetes vs. Metformin listed).

3. **[1:45 - 2:30] Clinician Decision & AYUSH:**
   - Enter clinician notes, amend a value, and click **Accept History**.
   - Switch to the **Ayurveda** tab to demonstrate Ashtavidha/Dashavidha Pariksha documentation.
   - Click **Export FHIR R4 (JSON)** to download the compliant FHIR bundle.

4. **[2:30 - 3:00] Administration & Security:**
   - Visit `/admin` to show live DB metrics, audit trail, and hospital role isolation.
   - Visit `/doctor/integrations` to verify ABDM sandbox and FHIR R4 conformance status.

---

## Windows Local Setup Instructions

### Prerequisites
- **Node.js** 20+
- **Python** 3.12 or 3.13
- **Git**

### 1. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt -r requirements-dev.txt pytest httpx

# Configure environment
cp .env.example .env
```

Ensure `backend/.env` contains:
```ini
APP_NAME=Jivsetu AI API
ENVIRONMENT=development
JWT_SECRET_KEY=dev_secret_key_change_in_production_32bytes_long
DATABASE_URL=sqlite:///./jivsetu_dev.db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DOCUMENT_STORAGE_PATH=./storage/medical_documents
OTP_PROVIDER=dev
DEMO_MODE=true
ABDM_MODE=disabled
```

Initialize database & seed demo data:
```powershell
python init_db.py --demo
```
*(Outputs the `demo-doctor` password to the console)*

Start FastAPI backend (Port 8001):
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8001
```
- Health Check: `http://127.0.0.1:8001/health`
- Swagger API Docs: `http://127.0.0.1:8001/docs`

### 2. Frontend Setup

Open a second PowerShell terminal:
```powershell
# Navigate to web root
npm install

# Configure local API URL
Set-Content -Path .env.local -Value "NEXT_PUBLIC_API_URL=http://127.0.0.1:8001"

# Run development server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Test Commands & Verification

### Backend Pytest Suite
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```
*(Runs all 55 backend unit & integration tests, including FHIR validation, security authorization, ABDM mock, AYUSH, and disease reconciliation rules)*

### Frontend Quality Checks
```powershell
npx tsc --noEmit
npm run lint
npm run build
```

---

## Security, Privacy & Compliance Notes

- **Password Hashing:** Argon2 via `pwdlib`.
- **Session Tokens:** Signed JWTs with server-side revocation on logout (`revoked_tokens` table).
- **Role-Based Authorization:** Server-enforced hospital isolation and object-level permissions on every API endpoint.
- **Document Isolation:** Uploaded documents stored with sanitized random filenames outside public web root; accessible only through authenticated endpoints.
- **Consent Ledger:** Append-only `consents` table tracking notice version, timestamp, and purpose.
- **Audit Logging:** Read-only audit log tracking login events, document access, and review decisions.
- **Development OTP:** `123456` development OTP is strictly refused when `ENVIRONMENT=production`.

---

## License

MIT License — see [LICENSE](LICENSE).
