"""Small in-memory, per-IP sliding-window limiter for credential endpoints.

Process-local: with several workers each keeps its own window. Use a shared
store (e.g. Redis) or a reverse-proxy limit for multi-instance deployments.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def rate_limit(max_requests: int, window_seconds: int):
    def dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"{request.url.path}:{ip}"
        now = time.monotonic()
        with _lock:
            q = _hits[key]
            while q and now - q[0] > window_seconds:
                q.popleft()
            if len(q) >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait a few minutes and try again.",
                    headers={"Retry-After": str(window_seconds)},
                )
            q.append(now)

    return dependency


def reset() -> None:
    with _lock:
        _hits.clear()
