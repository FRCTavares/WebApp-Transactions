import os
import shutil
import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _current_alembic_head() -> str:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "heads"],
        check=True,
        capture_output=True,
        text=True,
        cwd=BACKEND_DIR,
    )
    # "<revision> (head)" - keep just the revision id.
    return result.stdout.strip().split()[0]


def test_broken_migration_exits_non_zero(tmp_path):
    """A broken migration must make `alembic upgrade head` fail.

    Production Cloud Run releases use an explicit migration Job before
    schema-changing service deployments. This test verifies the application
    half of that gate: a real broken migration chained onto the current head
    exits non-zero against a temporary database.
    """

    migrations_copy = tmp_path / "migrations"
    shutil.copytree(BACKEND_DIR / "migrations", migrations_copy)

    current_head = _current_alembic_head()

    broken_revision = migrations_copy / "versions" / "zzzz_simulated_broken_migration.py"
    broken_revision.write_text(
        '"""simulated broken migration for migration failure test"""\n'
        "revision = \"zzzz_simulated_broken_migration\"\n"
        f"down_revision = \"{current_head}\"\n"
        "branch_labels = None\n"
        "depends_on = None\n"
        "\n\n"
        "def upgrade() -> None:\n"
        "    raise RuntimeError(\"simulated migration failure\")\n"
        "\n\n"
        "def downgrade() -> None:\n"
        "    pass\n"
    )

    temp_alembic_ini = tmp_path / "alembic.ini"
    real_ini_content = (BACKEND_DIR / "alembic.ini").read_text()
    temp_alembic_ini.write_text(
        real_ini_content.replace(
            "script_location = migrations",
            f"script_location = {migrations_copy}",
        )
    )

    database_path = tmp_path / "broken-migration.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{database_path}"

    result = subprocess.run(
        [
            sys.executable, "-m", "alembic",
            "-c", str(temp_alembic_ini),
            "upgrade", "head",
        ],
        env=env,
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "simulated migration failure" in (result.stdout + result.stderr)
