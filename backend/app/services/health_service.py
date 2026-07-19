from functools import lru_cache
from pathlib import Path
import os
import subprocess

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.database import engine


BACKEND_DIR = Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def get_build_commit() -> str:
    """Return a short commit identifier for the running deployment.

    Prefers the hosting platform's own git info over running git locally,
    since a production runtime environment may not have full git history
    (or git at all).
    """

    render_commit = os.getenv("RENDER_GIT_COMMIT", "").strip()

    if render_commit:
        return render_commit[:7]

    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=BACKEND_DIR,
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        return result.stdout.strip()
    except Exception:
        return "unknown"


def get_expected_revision_heads() -> set[str]:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option(
        "script_location",
        str(BACKEND_DIR / "migrations"),
    )
    script = ScriptDirectory.from_config(config)

    return set(script.get_heads())


def get_database_revision_heads(
    database_engine: Engine,
) -> set[str]:
    with database_engine.connect() as connection:
        connection.execute(text("SELECT 1"))
        context = MigrationContext.configure(connection)

        return set(context.get_current_heads())


def is_database_ready(
    database_engine: Engine = engine,
) -> bool:
    try:
        expected_heads = get_expected_revision_heads()
        current_heads = get_database_revision_heads(database_engine)
    except Exception:
        return False

    return bool(expected_heads) and current_heads == expected_heads
