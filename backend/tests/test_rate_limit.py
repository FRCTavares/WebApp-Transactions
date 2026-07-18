from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.current_user import CurrentUser, get_current_user
from app.main import app as production_app
from app.security.rate_limit import (
    InMemoryRateLimiter,
    RateLimitPolicy,
    build_rate_limit_dependency,
    enforce_export_rate_limit,
    enforce_market_fetch_rate_limit,
    enforce_rule_application_rate_limit,
    enforce_upload_rate_limit,
)


class FakeClock:
    def __init__(self) -> None:
        self.value = 100.0

    def __call__(self) -> float:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += seconds


def build_limited_app(
    *,
    limiter: InMemoryRateLimiter,
    policy: RateLimitPolicy,
) -> FastAPI:
    app = FastAPI()
    enforce_rate_limit = build_rate_limit_dependency(
        policy,
        limiter=limiter,
    )

    @app.get(
        "/limited",
        dependencies=[Depends(enforce_rate_limit)],
    )
    def limited():
        return {"status": "ok"}

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


def set_current_user(app: FastAPI, user_id: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=user_id
    )


def test_requests_over_limit_receive_controlled_429():
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    policy = RateLimitPolicy(
        name="test",
        max_requests=2,
        window_seconds=60,
    )
    app = build_limited_app(limiter=limiter, policy=policy)
    set_current_user(app, "user-one")

    with TestClient(app) as client:
        assert client.get("/limited").status_code == 200
        assert client.get("/limited").status_code == 200

        response = client.get("/limited")

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many requests"}
    assert response.headers["Retry-After"] == "60"
    assert "user-one" not in response.text
    assert "test" not in response.text


def test_users_have_independent_rate_limits():
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    policy = RateLimitPolicy(
        name="test",
        max_requests=1,
        window_seconds=60,
    )
    app = build_limited_app(limiter=limiter, policy=policy)

    set_current_user(app, "user-one")

    with TestClient(app) as client:
        assert client.get("/limited").status_code == 200
        assert client.get("/limited").status_code == 429

        set_current_user(app, "user-two")

        assert client.get("/limited").status_code == 200


def test_different_policies_have_independent_buckets():
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    first_policy = RateLimitPolicy(
        name="first",
        max_requests=1,
        window_seconds=60,
    )
    second_policy = RateLimitPolicy(
        name="second",
        max_requests=1,
        window_seconds=60,
    )

    assert limiter.check(
        policy=first_policy,
        identity="same-user",
    ) is None
    assert limiter.check(
        policy=first_policy,
        identity="same-user",
    ) == 60
    assert limiter.check(
        policy=second_policy,
        identity="same-user",
    ) is None


def test_expired_window_allows_requests_again():
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    policy = RateLimitPolicy(
        name="test",
        max_requests=1,
        window_seconds=30,
    )

    assert limiter.check(
        policy=policy,
        identity="user-one",
    ) is None
    assert limiter.check(
        policy=policy,
        identity="user-one",
    ) == 30

    clock.advance(30)

    assert limiter.check(
        policy=policy,
        identity="user-one",
    ) is None


def test_health_route_remains_available_after_limit_is_exhausted():
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    policy = RateLimitPolicy(
        name="test",
        max_requests=1,
        window_seconds=60,
    )
    app = build_limited_app(limiter=limiter, policy=policy)
    set_current_user(app, "user-one")

    with TestClient(app) as client:
        assert client.get("/limited").status_code == 200
        assert client.get("/limited").status_code == 429

        for _ in range(5):
            response = client.get("/api/health")
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}


def get_route_dependency_calls(
    *,
    path: str,
    method: str,
) -> set[object]:
    for route in production_app.routes:
        route_methods = getattr(route, "methods", set()) or set()

        if getattr(route, "path", None) != path:
            continue
        if method not in route_methods:
            continue

        dependant = getattr(route, "dependant", None)

        if dependant is None:
            raise AssertionError(f"Route has no dependant: {method} {path}")

        return {
            dependency.call
            for dependency in dependant.dependencies
        }

    raise AssertionError(f"Route was not found: {method} {path}")


def test_expensive_production_routes_use_expected_rate_limits():
    expected_routes = (
        (
            "POST",
            "/api/market-prices/fetch/latest",
            enforce_market_fetch_rate_limit,
        ),
        (
            "POST",
            "/api/market-prices/fetch/history",
            enforce_market_fetch_rate_limit,
        ),
        (
            "POST",
            "/api/import/preview",
            enforce_upload_rate_limit,
        ),
        (
            "POST",
            "/api/import/commit",
            enforce_upload_rate_limit,
        ),
        (
            "POST",
            "/api/import/fx-matches/preview",
            enforce_upload_rate_limit,
        ),
        (
            "POST",
            "/api/legacy-excel-import/preview",
            enforce_upload_rate_limit,
        ),
        (
            "POST",
            "/api/legacy-excel-import/commit",
            enforce_upload_rate_limit,
        ),
        (
            "POST",
            "/api/legacy-excel-import/wealth-preview",
            enforce_upload_rate_limit,
        ),
        (
            "POST",
            "/api/legacy-excel-import/wealth-commit",
            enforce_upload_rate_limit,
        ),
        (
            "GET",
            "/api/export/json",
            enforce_export_rate_limit,
        ),
        (
            "GET",
            "/api/transactions/export",
            enforce_export_rate_limit,
        ),
        (
            "GET",
            "/api/owed/export",
            enforce_export_rate_limit,
        ),
        (
            "POST",
            "/api/cashflow-rules/apply",
            enforce_rule_application_rate_limit,
        ),
        (
            "POST",
            "/api/description-rules/apply",
            enforce_rule_application_rate_limit,
        ),
    )

    for method, path, expected_dependency in expected_routes:
        dependency_calls = get_route_dependency_calls(
            path=path,
            method=method,
        )

        assert expected_dependency in dependency_calls, (
            f"Missing rate limit on {method} {path}"
        )


def test_health_and_readiness_routes_are_not_rate_limited():
    rate_limit_dependencies = {
        enforce_market_fetch_rate_limit,
        enforce_upload_rate_limit,
        enforce_export_rate_limit,
        enforce_rule_application_rate_limit,
    }

    for path in ("/api/health", "/api/ready"):
        dependency_calls = get_route_dependency_calls(
            path=path,
            method="GET",
        )

        assert dependency_calls.isdisjoint(rate_limit_dependencies)


def test_ordinary_api_route_is_not_expensively_rate_limited():
    dependency_calls = get_route_dependency_calls(
        path="/api/market-prices",
        method="GET",
    )

    assert enforce_market_fetch_rate_limit not in dependency_calls


def test_policy_rejects_invalid_configuration():
    invalid_values = (
        {"name": "", "max_requests": 1, "window_seconds": 1},
        {"name": "test", "max_requests": 0, "window_seconds": 1},
        {"name": "test", "max_requests": 1, "window_seconds": 0},
    )

    for values in invalid_values:
        try:
            RateLimitPolicy(**values)
        except ValueError:
            continue

        raise AssertionError(
            f"Expected invalid policy to fail: {values}"
        )
