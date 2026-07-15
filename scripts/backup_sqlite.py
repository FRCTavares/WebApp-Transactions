from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path


def create_sqlite_backup(
    source_path: Path,
    backup_path: Path,
) -> None:
    source_path = source_path.resolve()
    backup_path = backup_path.resolve()

    if not source_path.is_file():
        raise FileNotFoundError(
            f"Database not found: {source_path}"
        )

    backup_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    try:
        with sqlite3.connect(source_path) as source:
            with sqlite3.connect(backup_path) as destination:
                source.backup(destination)

        with sqlite3.connect(backup_path) as connection:
            integrity_result = connection.execute(
                "PRAGMA integrity_check"
            ).fetchone()

        if integrity_result != ("ok",):
            raise RuntimeError(
                "Backup failed integrity check: "
                f"{integrity_result}"
            )
    except Exception:
        backup_path.unlink(missing_ok=True)
        raise


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Create and validate a transactionally consistent "
            "SQLite backup."
        )
    )
    parser.add_argument(
        "source_path",
        type=Path,
    )
    parser.add_argument(
        "backup_path",
        type=Path,
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()

    try:
        create_sqlite_backup(
            args.source_path,
            args.backup_path,
        )
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Backup created: {args.backup_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
