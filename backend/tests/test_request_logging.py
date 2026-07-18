import json
import logging
import re

from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient

from app.auth.current_user import CurrentUser, get_current_user
from app.main import app as production_app
from app.middleware.request_logging import (
    REQUEST_LOGGER_NAME,
    RequestLoggingMiddleware,
    build_safe_user_identifier,
)


def get_request_events(caplog):
    return [
        json.loads(record.getMessage())
        for record in caplog.records
        if record.name == REQUEST_LOGGER_NAME
    ]


def build_test_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/items/{item_id}")
    def read_item(item_id: int):
        return {"item_id": item_id}

    return app


def test_request_log_is_structured_and_correlatable(caplog):
    app = build_test_app()
    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    with TestClient(app) as client:
        response = client.get(
            "/items/42?secret=query-value",
            headers={
                "X-Request-ID": "request-123",
                "Authorization": "Bearer secret-token",
            },
        )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "request-123"

    events = get_request_events(caplog)

    assert len(events) == 1
    assert events[0]["event"] == "http_request"
    assert events[0]["request_id"] == "request-123"
    assert events[0]["method"] == "GET"
    assert events[0]["route"] == "/items/{item_id}"
    assert events[0]["status"] == 200
    assert events[0]["duration_ms"] >= 0

    rendered_log = caplog.records[-1].getMessage()

    assert "secret-token" not in rendered_log
    assert "query-value" not in rendered_log
    assert "Authorization" not in rendered_log


def test_invalid_request_id_is_replaced(caplog):
    app = build_test_app()
    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    with TestClient(app) as client:
        response = client.get(
            "/items/7",
            headers={"X-Request-ID": "contains spaces"},
        )

    request_id = response.headers["X-Request-ID"]

    assert request_id != "contains spaces"
    assert re.fullmatch(r"[0-9a-f]{32}", request_id)

    events = get_request_events(caplog)

    assert events[-1]["request_id"] == request_id


def test_authenticated_user_log_identifier_is_safe(
    monkeypatch,
    caplog,
):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "person@example.com")

    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/whoami")
    def whoami(
        current_user: CurrentUser = Depends(get_current_user),
    ):
        return {"user_id": current_user.id}

    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={
                "X-App-User-Email": "PERSON@example.com",
                "X-App-Access-Token": "application-secret",
            },
        )

    assert response.status_code == 200

    events = get_request_events(caplog)
    event = events[-1]

    assert event["user_id"] == build_safe_user_identifier(
        "person@example.com"
    )

    rendered_log = caplog.records[-1].getMessage()

    assert "person@example.com" not in rendered_log
    assert "application-secret" not in rendered_log


def test_request_body_and_upload_contents_are_not_logged(caplog):
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.post("/upload")
    async def upload(request: Request):
        await request.body()
        return {"status": "accepted"}

    sensitive_content = "private financial transaction contents"
    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    with TestClient(app) as client:
        response = client.post(
            "/upload",
            content=sensitive_content,
            headers={
                "Content-Type": "text/csv",
                "X-Filename": "private-finances.csv",
            },
        )

    assert response.status_code == 200

    rendered_log = caplog.records[-1].getMessage()

    assert sensitive_content not in rendered_log
    assert "private-finances.csv" not in rendered_log
    assert "Content-Type" not in rendered_log


def test_unhandled_error_is_logged_without_exception_details(caplog):
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/failure")
    def failure():
        raise RuntimeError("database-password-is-secret")

    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    with TestClient(
        app,
        raise_server_exceptions=False,
    ) as client:
        response = client.get("/failure")

    assert response.status_code == 500
    assert response.json() == {
        "detail": "Internal server error"
    }
    assert re.fullmatch(
        r"[0-9a-f]{32}",
        response.headers["X-Request-ID"],
    )

    events = get_request_events(caplog)
    event = events[-1]

    assert event["request_id"] == response.headers["X-Request-ID"]
    assert event["route"] == "/failure"
    assert event["status"] == 500
    assert "database-password-is-secret" not in caplog.records[-1].getMessage()
    assert caplog.records[-1].exc_info is None

def test_real_app_logs_access_control_rejection(
    monkeypatch,
    caplog,
):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.setenv("APP_ACCESS_TOKEN", "expected-secret")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "person@example.com")

    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    with TestClient(production_app) as client:
        response = client.get(
            "/api/summary",
            headers={
                "X-Request-ID": "access-rejection-123",
                "X-App-Access-Token": "wrong-secret",
                "X-App-User-Email": "person@example.com",
            },
        )

    assert response.status_code == 401
    assert response.headers["X-Request-ID"] == "access-rejection-123"

    events = get_request_events(caplog)

    assert events[-1] == {
        "duration_ms": events[-1]["duration_ms"],
        "event": "http_request",
        "method": "GET",
        "request_id": "access-rejection-123",
        "route": "/api/summary",
        "status": 401,
    }

    rendered_log = caplog.records[-1].getMessage()

    assert "expected-secret" not in rendered_log
    assert "wrong-secret" not in rendered_log
    assert "person@example.com" not in rendered_log


def test_real_app_logs_upload_rejection_without_body(
    monkeypatch,
    caplog,
):
    monkeypatch.delenv("APP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)

    sensitive_body = b"private-financial-upload"
    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    with TestClient(production_app) as client:
        response = client.post(
            "/api/import/preview",
            content=sensitive_body,
            headers={
                "X-Request-ID": "upload-rejection-123",
                "Content-Type": "multipart/form-data",
                "Content-Length": str(22 * 1024 * 1024),
            },
        )

    assert response.status_code == 413
    assert response.headers["X-Request-ID"] == "upload-rejection-123"

    events = get_request_events(caplog)
    event = events[-1]

    assert event["event"] == "http_request"
    assert event["method"] == "POST"
    assert event["request_id"] == "upload-rejection-123"
    assert event["route"] == "/api/import/preview"
    assert event["status"] == 413
    assert event["duration_ms"] >= 0

    rendered_log = caplog.records[-1].getMessage()

    assert sensitive_body.decode() not in rendered_log
    assert "multipart/form-data" not in rendered_log
