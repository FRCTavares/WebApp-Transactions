from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.recovery_registry import (
    EXPORT_FORMAT_VERSION,
    USER_RECOVERY_TABLE_NAMES,
)


REQUIRED_TABLES = list(USER_RECOVERY_TABLE_NAMES)


@dataclass(frozen=True)
class ValidationIssue:
    message: str


def load_json_file(path: Path) -> Any:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise ValueError(f"File not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc


def validate_export(data: Any) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    if not isinstance(data, dict):
        return [ValidationIssue("Export root must be a JSON object.")]

    if data.get("format_version") != EXPORT_FORMAT_VERSION:
        issues.append(
            ValidationIssue(
                f"format_version must be {EXPORT_FORMAT_VERSION}."
            )
        )

    if not isinstance(data.get("user_id"), str) or not data.get("user_id"):
        issues.append(ValidationIssue("user_id must be a non-empty string."))

    if "email" not in data:
        issues.append(ValidationIssue("email field is missing."))

    tables = data.get("tables")

    if not isinstance(tables, dict):
        issues.append(ValidationIssue("tables must be a JSON object."))
        return issues

    for table_name in REQUIRED_TABLES:
        if table_name not in tables:
            issues.append(ValidationIssue(f"Missing required table: {table_name}."))
            continue

        if not isinstance(tables[table_name], list):
            issues.append(ValidationIssue(f"Table {table_name} must be a list."))

    for table_name, rows in tables.items():
        if not isinstance(table_name, str):
            issues.append(ValidationIssue("All table names must be strings."))
            continue

        if not isinstance(rows, list):
            continue

        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                issues.append(
                    ValidationIssue(f"Row {index} in table {table_name} must be an object."),
                )
                break

    return issues


def get_table_counts(data: Any) -> dict[str, int]:
    if not isinstance(data, dict):
        return {}

    tables = data.get("tables")

    if not isinstance(tables, dict):
        return {}

    return {
        table_name: len(rows)
        for table_name, rows in sorted(tables.items())
        if isinstance(rows, list)
    }


def print_results(path: Path, data: Any, issues: list[ValidationIssue]) -> None:
    if issues:
        print(f"FAIL {path}")
        for issue in issues:
            print(f"- {issue.message}")
        return

    print(f"PASS {path}")
    print("Table counts:")

    for table_name, count in get_table_counts(data).items():
        print(f"- {table_name}: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate a downloaded F - Transactions JSON export.",
    )
    parser.add_argument(
        "export_path",
        type=Path,
        help="Path to f-transactions-export-*.json",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable validation output.",
    )
    args = parser.parse_args()

    try:
        data = load_json_file(args.export_path)
    except ValueError as exc:
        if args.json:
            print(json.dumps({"passed": False, "issues": [str(exc)]}, indent=2))
        else:
            print(f"FAIL {args.export_path}")
            print(f"- {exc}")
        return 1

    issues = validate_export(data)

    if args.json:
        print(
            json.dumps(
                {
                    "passed": not issues,
                    "issues": [issue.message for issue in issues],
                    "table_counts": get_table_counts(data),
                },
                indent=2,
            ),
        )
    else:
        print_results(args.export_path, data, issues)

    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
