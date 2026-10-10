"""ABDM integration boundary.

All external ABDM communication must go through an `AbdmAdapter`, so the rest of the app never
talks to ABDM directly. What exists today:

* `MockAdapter`  - local simulation for development and tests. It contacts nothing and every
                   response is labelled `mock: true`. It can never mark an ABHA as verified.
* `SandboxAdapter` - placeholder. No official ABDM endpoint, request format or flow has been
                   copied or invented here; live exchange stays *pending* until credentials,
                   registration and the official specifications are available.
"""
import re
from typing import Any, Protocol

from app.config import settings

ABHA_NUMBER_RE = re.compile(r"^\d{14}$")
ABHA_ADDRESS_RE = re.compile(r"^[A-Za-z0-9._-]{3,64}@[A-Za-z0-9.-]{2,32}$")


class AbdmUnavailable(Exception):
    """ABDM is disabled or live exchange is not available."""


class AbdmInvalidInput(ValueError):
    pass


def normalize_abha_number(value: str) -> str:
    digits = re.sub(r"[\s-]", "", value or "")
    if not ABHA_NUMBER_RE.match(digits):
        raise AbdmInvalidInput("An ABHA number has 14 digits.")
    return digits


def normalize_abha_address(value: str | None) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    if not ABHA_ADDRESS_RE.match(value):
        raise AbdmInvalidInput("The ABHA address format is not valid.")
    return value


def mask_abha(number: str) -> str:
    return f"XX-XXXX-XXXX-{number[-4:]}"


class AbdmAdapter(Protocol):
    mode: str
    is_mock: bool

    def verify_abha(self, abha_number: str) -> dict[str, Any]: ...
    def share_bundle(self, bundle: dict[str, Any], abha_number: str) -> dict[str, Any]: ...


class MockAdapter:
    mode, is_mock = "mock", True

    def verify_abha(self, abha_number: str) -> dict[str, Any]:
        # Format was already checked; existence cannot be checked without ABDM.
        return {"mock": True, "verified": False, "message": "Mock mode: the ABHA was not checked against ABDM."}

    def share_bundle(self, bundle: dict[str, Any], abha_number: str) -> dict[str, Any]:
        return {
            "mock": True,
            "status": "simulated",
            "sent_to_abdm": False,
            "resource_count": len(bundle.get("entry", [])),
            "message": "Mock mode: nothing was sent to ABDM.",
        }


class SandboxAdapter:
    mode, is_mock = "sandbox", False

    def verify_abha(self, abha_number: str) -> dict[str, Any]:
        raise AbdmUnavailable("Live ABDM verification is pending official sandbox integration.")

    def share_bundle(self, bundle: dict[str, Any], abha_number: str) -> dict[str, Any]:
        raise AbdmUnavailable("Live ABDM data exchange is pending official sandbox integration and conformance.")


def get_adapter() -> AbdmAdapter:
    if settings.abdm_mode == "mock" and not settings.is_production:
        return MockAdapter()
    if settings.abdm_mode == "sandbox":
        return SandboxAdapter()
    raise AbdmUnavailable("ABDM integration is not enabled on this server.")


def status() -> dict[str, Any]:
    return {
        "mode": settings.abdm_mode,
        "live_exchange_available": False,
        "credentials_configured": bool(settings.abdm_client_id and settings.abdm_client_secret and settings.abdm_base_url),
        "note": "Live ABDM exchange is not implemented. Mock mode simulates responses locally.",
        "pending": [
            "Registration with ABDM and sandbox client credentials",
            "Facility (HIP) onboarding and registry identifiers",
            "Official ABDM API specifications and FHIR profiles for each exchange",
            "Consent-manager flow for sharing and fetching records",
            "Conformance testing in the ABDM sandbox",
        ],
    }
