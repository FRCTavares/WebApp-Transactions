from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import create_engine, func, select, update
from sqlalchemy.engine import Connection, Engine

import app.models  # noqa: F401
from app.recovery_registry import (
    USER_RECOVERY_MODEL_BY_TABLE,
    USER_RECOVERY_TABLE_NAMES,
)


MAX_USER_ID_LENGTH = 100


@dataclass(frozen=True)
class OwnershipMigrationResult:
    source_user_id: str
    target_user_id: str
    migrated_counts: dict[str, int]


def validate_user_id(value: str, label: str) -> str:
    user_id = value.strip()

    if not user_id:
        raise ValueError(f"{label} must not be empty")

    if len(user_id) > MAX_USER_ID_LENGTH:
        raise ValueError(
            f"{label} exceeds {MAX_USER_ID_LENGTH} characters"
        )

    return user_id


def get_user_row_counts(
    engine: Engine,
    user_id: str,
) -> dict[str, int]:
    with engine.connect() as connection:
        return _get_user_row_counts(connection, user_id)


def _get_user_row_counts(
    connection: Connection,
    user_id: str,
) -> dict[str, int]:
    counts: dict[str, int] = {}

    for table_name in USER_RECOVERY_TABLE_NAMES:
        model = USER_RECOVERY_MODEL_BY_TABLE[table_name]
        counts[table_name] = int(
            connection.execute(
                select(func.count())
                .select_from(model)
                .where(model.user_id == user_id)
            ).scalar_one()
        )

    return counts


def migrate_user_ownership(
    engine: Engine,
    source_user_id: str,
    target_user_id: str,
) -> OwnershipMigrationResult:
    source_user_id = validate_user_id(
        source_user_id,
        "source_user_id",
    )
    target_user_id = validate_user_id(
        target_user_id,
        "target_user_id",
    )

    if source_user_id == target_user_id:
        raise ValueError(
            "source_user_id and target_user_id must be different"
        )

    with engine.begin() as connection:
        source_counts = _get_user_row_counts(
            connection,
            source_user_id,
        )
        target_counts = _get_user_row_counts(
            connection,
            target_user_id,
        )

        if not any(source_counts.values()):
            raise RuntimeError(
                "Source user owns no rows; migration was not started"
            )

        target_tables_with_rows = {
            table_name: row_count
            for table_name, row_count in target_counts.items()
            if row_count > 0
        }

        if target_tables_with_rows:
            details = ", ".join(
                f"{table_name}={row_count}"
                for table_name, row_count in target_tables_with_rows.items()
            )
            raise RuntimeError(
                "Target user already owns rows; migration was not started: "
                + details
            )

        for table_name in USER_RECOVERY_TABLE_NAMES:
            model = USER_RECOVERY_MODEL_BY_TABLE[table_name]
            connection.execute(
                update(model)
                .where(model.user_id == source_user_id)
                .values(user_id=target_user_id)
            )

        remaining_source_counts = _get_user_row_counts(
            connection,
            source_user_id,
        )
        migrated_target_counts = _get_user_row_counts(
            connection,
            target_user_id,
        )

        if any(remaining_source_counts.values()):
            raise RuntimeError(
                "Ownership migration verification failed: source rows remain"
            )

        if migrated_target_counts != source_counts:
            raise RuntimeError(
                "Ownership migration verification failed: row counts changed"
            )

    return OwnershipMigrationResult(
        source_user_id=source_user_id,
        target_user_id=target_user_id,
        migrated_counts=migrated_target_counts,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Atomically migrate all user-owned rows from a legacy owner "
            "identifier to a Supabase subject."
        )
    )
    parser.add_argument(
        "--database-url",
        required=True,
        help="SQLAlchemy database URL.",
    )
    parser.add_argument(
        "--from-user-id",
        required=True,
        help="Current owner identifier, normally the normalized email.",
    )
    parser.add_argument(
        "--to-user-id",
        required=True,
        help="Target Supabase sub value.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform the migration. Without this flag only counts are shown.",
    )

    return parser


def main() -> int:
    args = build_parser().parse_args()
    source_user_id = validate_user_id(
        args.from_user_id,
        "from_user_id",
    )
    target_user_id = validate_user_id(
        args.to_user_id,
        "to_user_id",
    )
    engine = create_engine(args.database_url)

    source_counts = get_user_row_counts(engine, source_user_id)
    target_counts = get_user_row_counts(engine, target_user_id)

    print(f"source_user_id={source_user_id}")
    print(f"target_user_id={target_user_id}")

    for table_name in USER_RECOVERY_TABLE_NAMES:
        print(
            f"{table_name}: "
            f"source={source_counts[table_name]}, "
            f"target={target_counts[table_name]}"
        )

    if not args.apply:
        print("Dry run only. Re-run with --apply to migrate ownership.")
        return 0

    result = migrate_user_ownership(
        engine=engine,
        source_user_id=source_user_id,
        target_user_id=target_user_id,
    )

    print("Ownership migration completed and verified.")

    for table_name, row_count in result.migrated_counts.items():
        print(f"{table_name}: migrated={row_count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
