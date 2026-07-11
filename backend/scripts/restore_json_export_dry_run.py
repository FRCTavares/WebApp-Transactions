from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import Date, DateTime, Numeric, create_engine, insert
from sqlalchemy.engine import Engine

import app.models  # noqa: F401
from app.database import Base
from scripts.audit_data_integrity import run_audit
from scripts.validate_json_export import REQUIRED_TABLES, load_json_file, validate_export


RESTORE_TABLE_ORDER = [
    "import_batches",
    "transactions",
    "owed_items",
    "owed_payments",
    "owed_payment_allocations",
    "wealth_accounts",
    "wealth_snapshots",
    "investment_events",
    "cashflow_rules",
    "description_rules",
]


def create_sqlite_engine(sqlite_path: Path) -> Engine:
    return create_engine(
        f"sqlite:///{sqlite_path}",
        connect_args={"check_same_thread": False},
    )


def convert_value(value: Any, column_type: Any) -> Any:
    if value is None:
        return None

    if isinstance(column_type, DateTime):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value)

    if isinstance(column_type, Date):
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value)

    if isinstance(column_type, Numeric):
        return Decimal(str(value))

    return value


def normalise_row_for_table(table_name: str, row: dict[str, Any]) -> dict[str, Any]:
    table = Base.metadata.tables[table_name]
    normalised_row: dict[str, Any] = {}

    for column in table.columns:
        if column.name in row:
            normalised_row[column.name] = convert_value(row[column.name], column.type)

    return normalised_row


def restore_export_to_engine(data: dict[str, Any], engine: Engine) -> dict[str, int]:
    tables = data["tables"]
    restored_counts: dict[str, int] = {}

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        for table_name in RESTORE_TABLE_ORDER:
            rows = tables.get(table_name, [])

            if not rows:
                restored_counts[table_name] = 0
                continue

            table = Base.metadata.tables[table_name]
            normalised_rows = [
                normalise_row_for_table(table_name, row)
                for row in rows
            ]

            connection.execute(insert(table), normalised_rows)
            restored_counts[table_name] = len(normalised_rows)

    return restored_counts


def run_restore_dry_run(export_path: Path, sqlite_path: Path) -> tuple[dict[str, int], list[dict[str, object]]]:
    data = load_json_file(export_path)
    issues = validate_export(data)

    if issues:
        messages = "; ".join(issue.message for issue in issues)
        raise ValueError(f"Export validation failed: {messages}")

    if not isinstance(data, dict):
        raise ValueError("Export root must be a JSON object.")

    engine = create_sqlite_engine(sqlite_path)
    restored_counts = restore_export_to_engine(data, engine)
    audit_results = run_audit(engine)

    return restored_counts, audit_results


def print_results(
    export_path: Path,
    sqlite_path: Path,
    restored_counts: dict[str, int],
    audit_results: list[dict[str, object]],
) -> None:
    print(f"PASS restore dry-run for {export_path}")
    print(f"Temporary SQLite DB: {sqlite_path}")
    print("Restored table counts:")

    for table_name in REQUIRED_TABLES:
        print(f"- {table_name}: {restored_counts.get(table_name, 0)}")

    print("Integrity audit:")

    for result in audit_results:
        status = "PASS" if result["passed"] else "FAIL"
        print(f"- {status} {result['name']}: {result['violations']} violation(s)")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Restore a JSON export into temporary SQLite and run integrity checks.",
    )
    parser.add_argument(
        "export_path",
        type=Path,
        help="Path to f-transactions-export-*.json",
    )
    parser.add_argument(
        "--keep-db",
        type=Path,
        default=None,
        help="Keep the restored SQLite database at this path.",
    )
    args = parser.parse_args()

    try:
        if args.keep_db is not None:
            sqlite_path = args.keep_db
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)

            if sqlite_path.exists():
                sqlite_path.unlink()

            restored_counts, audit_results = run_restore_dry_run(args.export_path, sqlite_path)
            print_results(args.export_path, sqlite_path, restored_counts, audit_results)
        else:
            with tempfile.TemporaryDirectory() as temporary_directory:
                sqlite_path = Path(temporary_directory) / "restore_dry_run.db"
                restored_counts, audit_results = run_restore_dry_run(args.export_path, sqlite_path)
                print_results(args.export_path, sqlite_path, restored_counts, audit_results)

        failed_checks = [result for result in audit_results if not result["passed"]]
        return 1 if failed_checks else 0
    except Exception as exc:
        print(f"FAIL restore dry-run for {args.export_path}")
        print(f"- {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
