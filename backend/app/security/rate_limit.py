from __future__ import annotations

import math
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status

from app.auth.current_user import CurrentUser, get_current_user


Clock = Callable[[], float]


@dataclass(frozen=True)
class RateLimitPolicy:
    name: str
    max_requests: int
    window_seconds: int

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("Rate-limit policy name is required")
        if self.max_requests <= 0:
            raise ValueError("Rate-limit request count must be positive")
        if self.window_seconds <= 0:
            raise ValueError("Rate-limit window must be positive")


@dataclass
class RateLimitBucket:
    count: int
    reset_at: float


class InMemoryRateLimiter:
    """Process-local fixed-window limiter for the current single-worker service."""

    def __init__(self, *, clock: Clock = time.monotonic) -> None:
        self._clock = clock
        self._buckets: dict[tuple[str, str], RateLimitBucket] = {}
        self._lock = threading.Lock()

    def check(
        self,
        *,
        policy: RateLimitPolicy,
        identity: str,
    ) -> int | None:
        now = self._clock()
        key = (policy.name, identity)

        with self._lock:
            self._remove_expired_buckets(now)

            bucket = self._buckets.get(key)

            if bucket is None:
                self._buckets[key] = RateLimitBucket(
                    count=1,
                    reset_at=now + policy.window_seconds,
                )
                return None

            if bucket.count >= policy.max_requests:
                return max(1, math.ceil(bucket.reset_at - now))

            bucket.count += 1
            return None

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()

    def _remove_expired_buckets(self, now: float) -> None:
        expired_keys = [
            key
            for key, bucket in self._buckets.items()
            if bucket.reset_at <= now
        ]

        for key in expired_keys:
            del self._buckets[key]


RATE_LIMITER = InMemoryRateLimiter()

MARKET_FETCH_POLICY = RateLimitPolicy(
    name="market-fetch",
    max_requests=20,
    window_seconds=300,
)
UPLOAD_POLICY = RateLimitPolicy(
    name="upload",
    max_requests=60,
    window_seconds=600,
)
EXPORT_POLICY = RateLimitPolicy(
    name="export",
    max_requests=20,
    window_seconds=600,
)
RULE_APPLICATION_POLICY = RateLimitPolicy(
    name="rule-application",
    max_requests=20,
    window_seconds=300,
)


def build_rate_limit_dependency(
    policy: RateLimitPolicy,
    *,
    limiter: InMemoryRateLimiter = RATE_LIMITER,
):
    def enforce_rate_limit(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> None:
        retry_after = limiter.check(
            policy=policy,
            identity=current_user.id,
        )

        if retry_after is None:
            return

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests",
            headers={"Retry-After": str(retry_after)},
        )

    enforce_rate_limit.__name__ = f"enforce_{policy.name.replace('-', '_')}_rate_limit"
    return enforce_rate_limit


enforce_market_fetch_rate_limit = build_rate_limit_dependency(
    MARKET_FETCH_POLICY
)
enforce_upload_rate_limit = build_rate_limit_dependency(UPLOAD_POLICY)
enforce_export_rate_limit = build_rate_limit_dependency(EXPORT_POLICY)
enforce_rule_application_rate_limit = build_rate_limit_dependency(
    RULE_APPLICATION_POLICY
)
