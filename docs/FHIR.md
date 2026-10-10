# FHIR export

JivSetu exports a visit as an **HL7 FHIR R4 (R4B package, 4.3.0) `collection` Bundle**.
This is an *export mapping*, not a FHIR server. Internal database models are unchanged.

```
GET /fhir/metadata                  supported resources and limitations (public)
GET /fhir/visits/{visit_id}/bundle  Bundle as application/fhir+json (doctor/admin, own hospital only; audited as fhir.export)
```

The doctor case page has an **Export FHIR R4 (JSON)** button.

## Mapping

| FHIR resource | Source | Notes |
|---|---|---|
| Organization | `hospitals` | Facility code only; no HFR id is claimed |
| Patient | `patients` | Identifier `urn:jivsetu:id` — **not an ABHA number** |
| Encounter | `patient_visits` | Status mapped from visit status, class `AMB` |
| Condition | chief complaint; diabetes = yes | `verificationStatus: unconfirmed`, free-text `code.text` |
| MedicationStatement | patient answer + prescription extraction | `status: unknown` (adherence is not known) |
| AllergyIntolerance | allergy answer | `unconfirmed`; "none" produces no resource |
| Flag | red flags | Not a diagnosis |
| Observation | extracted lab values | `preliminary`, or `final` once a clinician reviewed the extraction; `derivedFrom` the DocumentReference |
| DocumentReference | uploaded documents | `docStatus: preliminary`; `url` is the access-controlled API path, bytes are not embedded |
| Consent | consent ledger | Latest entry per purpose: `active` / `rejected` |
| Provenance | all clinical resources | Assembler = JivSetu draft (mapping version); verifier = reviewing clinician when present |

Every resource carries `meta.tag` for its source — `patient-reported`, `document-extracted`,
`clinician-verified`, `patient-uploaded` or `system` — and the mapping version (`jivsetu-fhir-r4-0.1`).
Resource ids are `uuid5(type:internal id)`, so re-exports are stable and references resolve inside the Bundle.

## Rules

- Nothing is invented: no SNOMED CT / LOINC / ICD codes are assigned; negative or unknown answers create no resource.
- Only values a clinician edited are `clinician-verified`. AI output never overwrites them.
- Urgent flags are independent of extraction coverage.

## Validation

`app/services/fhir.py::validate_bundle` runs the `fhir.resources` R4B models (types, required elements,
cardinality), checks that every `urn:uuid` reference resolves inside the Bundle, and checks the status codes
the mapper emits. An export that fails validation returns HTTP 500 with the issues instead of invalid data.

**Not covered:** the official HL7 Java validator, ABDM / NRCeS profiles, and terminology bindings.
Run those before any ABDM exchange. Tests: `backend/tests/test_fhir.py` (synthetic data only).
