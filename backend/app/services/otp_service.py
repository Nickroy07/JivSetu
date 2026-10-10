"""
OTP delivery.

Providers:
- "dev":   code generated locally, stored as an HMAC, and shown on screen.
           Refused when ENVIRONMENT=production (see config validation).
- "msg91": MSG91 generates, delivers and verifies the code.
"""

import hashlib
import hmac
import secrets

import httpx

from app.config import settings

MSG91_BASE_URL = "https://control.msg91.com/api/v5/otp"


class OtpProviderError(Exception):
    pass


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(mobile: str, code: str) -> str:
    key = settings.jwt_secret_key.encode()
    return hmac.new(key, f"{mobile}:{code}".encode(), hashlib.sha256).hexdigest()


def codes_match(mobile: str, code: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    return hmac.compare_digest(hash_code(mobile, code), stored_hash)


def msg91_configured() -> bool:
    return bool(settings.msg91_authkey and settings.msg91_template_id)


def msg91_send(mobile: str) -> None:
    params = {"template_id": settings.msg91_template_id, "mobile": f"91{mobile}"}
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(MSG91_BASE_URL, params=params, headers={"authkey": settings.msg91_authkey})
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OtpProviderError("SMS provider unreachable.") from exc
    if response.status_code >= 400 or data.get("type") != "success":
        raise OtpProviderError("SMS provider rejected the request.")


def msg91_verify(mobile: str, otp: str) -> bool:
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                f"{MSG91_BASE_URL}/verify",
                params={"otp": otp, "mobile": f"91{mobile}"},
                headers={"authkey": settings.msg91_authkey},
            )
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OtpProviderError("SMS provider unreachable.") from exc
    return response.status_code < 400 and data.get("type") == "success"
