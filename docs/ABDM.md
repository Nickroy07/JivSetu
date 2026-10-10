# ABDM integration status

**Live ABDM integration is NOT implemented.** No request has ever been sent to ABDM from this code,
and no successful exchange has been demonstrated. What exists is the boundary and a local simulation.

| Piece | Status |
|---|---|
| Adapter interface (`backend/app/services/abdm.py`) | Implemented; all ABDM calls must go through it |
| `ABDM_MODE=mock` | Local simulation. Every response says `mock: true`, `sent_to_abdm: false`. Refused in production |
| `ABDM_MODE=sandbox` | **Pending.** Returns HTTP 501. No ABDM endpoint, payload or flow has been copied or invented |
| ABHA capture | Staff can record a patient's ABHA (14 digits, optional address). Stored masked in responses, never logged |
| ABHA verification | The mock can never mark an ABHA verified; `verified` is only set by a real ABDM response |
| FHIR payload | Reuses the validated bundle from [FHIR.md](FHIR.md) (structural validation only, not ABDM profile validation) |
| Consent | Sharing requires the patient's **current** `abdm_sharing` consent; withdrawing it blocks sharing |

ABHA is separate from the JivSetu patient id and from card / QR tokens. A card or QR is never proof of an ABHA.

## API (staff only, own hospital)

```
GET  /abdm/status
PUT  /abdm/patients/{id}/abha            {abha_number, abha_address?}
GET  /abdm/patients/{id}/abha
POST /abdm/patients/{id}/abha/verify
POST /abdm/visits/{id}/share             requires ABHA + abdm_sharing consent
```

Errors: 503 when disabled, 501 when live exchange is requested, 409 when ABHA or consent is missing.

## Configuration (placeholders only)

```
ABDM_MODE=disabled      # disabled | mock | sandbox
ABDM_CLIENT_ID=
ABDM_CLIENT_SECRET=
ABDM_BASE_URL=
```

## Checklist before any live exchange

1. Register with ABDM and obtain sandbox client credentials.
2. Onboard the facility (HIP) and obtain registry identifiers; keep them separate from internal ids.
3. Obtain the official API specifications and FHIR profiles for each exchange; implement `SandboxAdapter` from those documents.
4. Implement the consent-manager flow and token handling with timeouts and safe logging.
5. Add a patient-facing screen to grant / withdraw `abdm_sharing` consent (API exists; no UI yet).
6. Pass ABDM conformance testing in the sandbox before moving to production.
