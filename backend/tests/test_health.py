from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

import app.routers.health as health_router
from app.main import app
from app.services.health_service import (
    get_build_commit,
    get_expected_revision_heads,
    is_database_ready,
)


def create_test_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def stamp_database(engine, revisions: set[str]) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE alembic_version ("
                "version_num VARCHAR(32) NOT NULL PRIMARY KEY"
                ")"
            )
        )

        for revision in revisions:
            connection.execute(
                text(
                    "INSERT INTO alembic_version (version_num) "
                    "VALUES (:revision)"
                ),
                {"revision": revision},
            )


def test_liveness_remains_independent_of_readiness(monkeypatch):
    monkeypatch.setattr(
        health_router,
        "is_database_ready",
        lambda: False,
    )

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["version"], str)
    assert body["version"]


def test_build_commit_prefers_render_git_commit_env_var(monkeypatch):
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abcdef1234567890")
    get_build_commit.cache_clear()

    try:
        assert get_build_commit() == "abcdef1"
    finally:
        get_build_commit.cache_clear()


def test_build_commit_falls_back_to_local_git(monkeypatch):
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    get_build_commit.cache_clear()

    try:
        commit = get_build_commit()
    finally:
        get_build_commit.cache_clear()

    assert commit != "unknown"
    assert len(commit) == 7


def test_database_readiness_accepts_current_revision():
    engine = create_test_engine()
    stamp_database(engine, get_expected_revision_heads())

    assert is_database_ready(engine) is True


def test_database_readiness_rejects_outdated_revision():
    engine = create_test_engine()
    stamp_database(engine, {"outdated-revision"})

    assert is_database_ready(engine) is False


def test_database_readiness_rejects_unavailable_database():
    class UnavailableEngine:
        def connect(self):
            raise RuntimeError("database unavailable")

    assert is_database_ready(UnavailableEngine()) is False


def test_readiness_returns_controlled_unavailable_response(
    monkeypatch,
):
    monkeypatch.setattr(
        health_router,
        "is_database_ready",
        lambda: False,
    )

    with TestClient(app) as client:
        response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}


def test_readiness_is_public_and_suitable_for_render(
    monkeypatch,
):
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "true")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setattr(
        health_router,
        "is_database_ready",
        lambda: True,
    )

    with TestClient(app) as client:
        response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
