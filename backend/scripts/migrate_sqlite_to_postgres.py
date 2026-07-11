from __future__ import annotations

import argparse
from getpass import getpass
from pathlib import Path
from typing import Any

from sqlalchemy import MetaData, Table, create_engine, func, insert, select, text
from sqlalchemy.engine import Engine


TABLE_ORDER = [
    "import_batches",
    "transactions",
    "wealth_accounts",
    "owed_items",
    "owed_payments",
    "owed_payment_allocations",
    "investment_events",
    "market_prices",
    "market_price_history",
    "wealth_snapshots",
    "cashflow_rules",
    "description_rules",
]

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parents[1] / "data" / "finance.db"


def normalise_database_url(database_url: str) -> str:
    database_url = database_url.strip()

    if database_url.startswith("postgresql+psycopg://"):
        return database_url

    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)

    return database_url


def make_sqlite_engine(sqlite_path: Path) -> Engine:
    return create_engine(f"sqlite:///{sqlite_path}")


def make_postgres_engine(database_url: str) -> Engine:
    return create_engine(normalise_database_url(database_url))


def reflect_tables(engine: Engine) -> dict[str, Table]:
    metadata = MetaData()
    metadata.reflect(bind=engine, only=TABLE_ORDER)
    return {name: metadata.tables[name] for name in TABLE_ORDER}


def fetch_rows(engine: Engine, table: Table) -> list[dict[str, Any]]:
    with engine.connect() as connection:
        result = connection.execute(select(table).order_by(table.c.id))
        return [dict(row) for row in result.mappings().all()]


def count_rows(engine: Engine, table: Table) -> int:
    with engine.connect() as connection:
        return int(connection.execute(select(func.count()).select_from(table)).scalar_one())


def get_id_range(engine: Engine, table: Table) -> tuple[int | None, int | None]:
    with engine.connect() as connection:
        min_id = connection.execute(select(func.min(table.c.id))).scalar_one()
        max_id = connection.execute(select(func.max(table.c.id))).scalar_one()
        return min_id, max_id


def check_table_columns(source_tables: dict[str, Table], target_tables: dict[str, Table]) -> None:
    print("===== schema column check =====")
    for table_name in TABLE_ORDER:
        source_columns = set(source_tables[table_name].columns.keys())
        target_columns = set(target_tables[table_name].columns.keys())

        missing_in_target = sorted(source_columns - target_columns)
        extra_in_target = sorted(target_columns - source_columns)

        print(f"{table_name}|source_cols={len(source_columns)}|target_cols={len(target_columns)}")

        if missing_in_target:
            raise RuntimeError(
                f"{table_name}: source columns missing in target: {missing_in_target}"
            )

        if extra_in_target:
            raise RuntimeError(
                f"{table_name}: target has extra columns not present in source: {extra_in_target}"
            )


def check_target_empty(target_engine: Engine, target_tables: dict[str, Table]) -> None:
    print("")
    print("===== target emptiness check =====")
    non_empty_tables: list[str] = []

    for table_name in TABLE_ORDER:
        count = count_rows(target_engine, target_tables[table_name])
        print(f"{table_name}|{count}")
        if count != 0:
            non_empty_tables.append(table_name)

    if non_empty_tables:
        raise RuntimeError(
            "Refusing to migrate because target is not empty: "
            + ", ".join(non_empty_tables)
        )


def print_source_summary(source_engine: Engine, source_tables: dict[str, Table]) -> dict[str, int]:
    print("")
    print("===== source sqlite summary =====")
    counts: dict[str, int] = {}

    for table_name in TABLE_ORDER:
        table = source_tables[table_name]
        count = count_rows(source_engine, table)
        min_id, max_id = get_id_range(source_engine, table)
        counts[table_name] = count
        print(f"{table_name}|{count}|min_id={min_id}|max_id={max_id}")

    return counts


def insert_rows(
    target_engine: Engine,
    target_tables: dict[str, Table],
    source_rows_by_table: dict[str, list[dict[str, Any]]],
) -> None:
    print("")
    print("===== inserting rows =====")

    with target_engine.begin() as connection:
        for table_name in TABLE_ORDER:
            rows = source_rows_by_table[table_name]
            print(f"{table_name}|insert={len(rows)}")

            if rows:
                connection.execute(insert(target_tables[table_name]), rows)


def reset_postgres_sequences(target_engine: Engine, target_tables: dict[str, Table]) -> None:
    print("")
    print("===== resetting postgres sequences =====")

    with target_engine.begin() as connection:
        for table_name in TABLE_ORDER:
            table = target_tables[table_name]
            max_id = connection.execute(select(func.max(table.c.id))).scalar_one()

            if max_id is None:
                print(f"{table_name}|empty|skip")
                continue

            sequence_name = connection.execute(
                text("SELECT pg_get_serial_sequence(:table_name, 'id')"),
                {"table_name": table_name},
            ).scalar_one()

            if sequence_name is None:
                print(f"{table_name}|no sequence|skip")
                continue

            connection.execute(
                text("SELECT setval(:sequence_name, :next_value, true)"),
                {"sequence_name": sequence_name, "next_value": int(max_id)},
            )
            print(f"{table_name}|sequence={sequence_name}|set_to={max_id}")


def verify_counts(
    target_engine: Engine,
    target_tables: dict[str, Table],
    expected_counts: dict[str, int],
) -> None:
    print("")
    print("===== target verification =====")

    mismatches: list[str] = []

    for table_name in TABLE_ORDER:
        actual = count_rows(target_engine, target_tables[table_name])
        expected = expected_counts[table_name]
        min_id, max_id = get_id_range(target_engine, target_tables[table_name])
        print(f"{table_name}|actual={actual}|expected={expected}|min_id={min_id}|max_id={max_id}")

        if actual != expected:
            mismatches.append(f"{table_name}: actual={actual}, expected={expected}")

    if mismatches:
        raise RuntimeError("Count verification failed: " + "; ".join(mismatches))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely migrate local SQLite finance data to Postgres."
    )
    parser.add_argument(
        "--sqlite-path",
        type=Path,
        default=DEFAULT_SQLITE_PATH,
        help="Path to local SQLite database.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually insert rows. Without this flag, only performs a dry run.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sqlite_path = args.sqlite_path.resolve()

    if not sqlite_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {sqlite_path}")

    database_url = getpass("Supabase DATABASE_URL: ").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required.")

    source_engine = make_sqlite_engine(sqlite_path)
    target_engine = make_postgres_engine(database_url)

    source_tables = reflect_tables(source_engine)
    target_tables = reflect_tables(target_engine)

    print(f"sqlite_path={sqlite_path}")
    print(f"mode={'EXECUTE' if args.execute else 'DRY RUN'}")

    check_table_columns(source_tables, target_tables)
    expected_counts = print_source_summary(source_engine, source_tables)
    check_target_empty(target_engine, target_tables)

    source_rows_by_table = {
        table_name: fetch_rows(source_engine, source_tables[table_name])
        for table_name in TABLE_ORDER
    }

    if not args.execute:
        print("")
        print("DRY RUN COMPLETE. No rows were inserted.")
        print("Run again with --execute to migrate.")
        return

    insert_rows(target_engine, target_tables, source_rows_by_table)
    reset_postgres_sequences(target_engine, target_tables)
    verify_counts(target_engine, target_tables, expected_counts)

    print("")
    print("MIGRATION COMPLETE.")


if __name__ == "__main__":
    main()
