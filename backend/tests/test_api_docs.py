import json
import os
import subprocess
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]

INSPECT_APP_SCRIPT = """
import json

from app.main import app

documentation_paths = {
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
    "/openapi.json",
}

print(
    json.dumps(
        {
            "docs_url": app.docs_url,
            "redoc_url": app.redoc_url,
            "openapi_url": app.openapi_url,
            "documentation_routes": sorted(
                route.path
                for route in app.routes
                if getattr(route, "path", None) in documentation_paths
            ),
        }
    )
)
"""


def inspect_api_docs(
    *,
    app_env: str,
    api_docs_enabled: str | None,
) -> dict[str, object]:
    environment = os.environ.copy()
    environment["APP_ENV"] = app_env

    if api_docs_enabled is None:
        environment.pop("API_DOCS_ENABLED", None)
    else:
        environment["API_DOCS_ENABLED"] = api_docs_enabled

    result = subprocess.run(
        [sys.executable, "-c", INSPECT_APP_SCRIPT],
        cwd=BACKEND_ROOT,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )

    return json.loads(result.stdout)


def test_api_docs_are_enabled_by_default_in_development():
    result = inspect_api_docs(
        app_env="development",
        api_docs_enabled=None,
    )

    assert result == {
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "openapi_url": "/openapi.json",
        "documentation_routes": [
            "/docs",
            "/docs/oauth2-redirect",
            "/openapi.json",
            "/redoc",
        ],
    }


def test_api_docs_are_disabled_by_default_in_production():
    result = inspect_api_docs(
        app_env="production",
        api_docs_enabled=None,
    )

    assert result == {
        "docs_url": None,
        "redoc_url": None,
        "openapi_url": None,
        "documentation_routes": [],
    }


def test_api_docs_can_be_deliberately_enabled_in_production():
    result = inspect_api_docs(
        app_env="production",
        api_docs_enabled="true",
    )

    assert result == {
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "openapi_url": "/openapi.json",
        "documentation_routes": [
            "/docs",
            "/docs/oauth2-redirect",
            "/openapi.json",
            "/redoc",
        ],
    }
