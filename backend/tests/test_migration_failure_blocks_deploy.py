import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, text


def test_alembic_upgrade_head_fails_loudly_on_unknown_revision(tmp_path):
    """Proves Render's preDeployCommand (alembic upgrade head) actually
    blocks a deploy when the database is in a state migrations can't
    resolve - e.g. stamped with a revision that no longer exists in this
    codebase. Render's documented behavior: if preDeployCommand exits
    non-zero, the deploy fails and the previous version stays live."""

    database_path = tmp_path / "alembic_upgrade_failure.db"
    database_url = f"sqlite:///{database_path}"

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE alembic_version ("
                "version_num VARCHAR(32) NOT NULL PRIMARY KEY"
                ")"
            )
        )
        connection.execute(
            text(
                "INSERT INTO alembic_version (version_num) "
                "VALUES ('does-not-exist-0000000000')"
            )
        )
    engine.dispose()

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        env=env,
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "does-not-exist-0000000000" in (result.stdout + result.stderr)
