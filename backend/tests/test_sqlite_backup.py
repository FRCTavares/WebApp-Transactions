import os
import sqlite3
import subprocess
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BACKUP_SCRIPT = REPOSITORY_ROOT / "scripts" / "backup_sqlite.sh"


def run_backup(
    database_path: Path,
    backup_directory: Path,
) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["PYTHON_BIN"] = os.environ.get(
        "PYTHON_BIN",
        "python3",
    )

    return subprocess.run(
        [
            str(BACKUP_SCRIPT),
            str(database_path),
            str(backup_directory),
        ],
        cwd=REPOSITORY_ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )


def test_sqlite_backup_captures_committed_wal_rows(tmp_path):
    database_path = tmp_path / "live.db"
    backup_directory = tmp_path / "backups"

    source = sqlite3.connect(database_path)
    source.execute("PRAGMA journal_mode=WAL")
    source.execute(
        "CREATE TABLE transactions ("
        "id INTEGER PRIMARY KEY, "
        "description TEXT NOT NULL"
        ")"
    )
    source.execute(
        "INSERT INTO transactions (description) "
        "VALUES (?)",
        ("committed before backup",),
    )
    source.commit()

    result = run_backup(
        database_path,
        backup_directory,
    )

    source.close()

    assert result.returncode == 0, result.stderr
    assert "Backup created:" in result.stdout

    backup_files = list(
        backup_directory.glob("finance-*.db")
    )

    assert len(backup_files) == 1

    with sqlite3.connect(backup_files[0]) as backup:
        integrity_result = backup.execute(
            "PRAGMA integrity_check"
        ).fetchone()
        rows = backup.execute(
            "SELECT id, description "
            "FROM transactions"
        ).fetchall()

    assert integrity_result == ("ok",)
    assert rows == [
        (1, "committed before backup"),
    ]


def test_sqlite_backup_rejects_missing_database(tmp_path):
    result = run_backup(
        tmp_path / "missing.db",
        tmp_path / "backups",
    )

    assert result.returncode != 0
    assert "Database not found:" in result.stderr
    assert not (tmp_path / "backups").exists()
