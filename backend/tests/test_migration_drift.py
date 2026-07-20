"""CI gate: fail if an Alembic migration outruns the legacy SQLite path.

See `scripts/check_migration_drift.py` for the full rationale. This test
just wires that static check into the normal backend test run so it
actually blocks CI (`python -m pytest -q` in .github/workflows/ci.yml),
matching TODO_LIST.md section 7.
"""

from scripts.check_migration_drift import find_migration_drift


def test_no_alembic_legacy_sqlite_migration_drift():
    problems = find_migration_drift()

    assert not problems, (
        "Alembic migration(s) add/rename a column or table with no "
        "matching reference in app/database_migrations.py:\n"
        + "\n".join(f"  - {problem}" for problem in problems)
    )
