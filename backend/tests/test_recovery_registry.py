import app.models  # noqa: F401
from app.database import Base
from app.recovery_registry import (
    MIGRATION_TABLE_ORDER,
    NON_RECOVERABLE_USER_TABLE_NAMES,
    USER_RECOVERY_TABLE_NAMES,
)
from scripts.migrate_sqlite_to_postgres import TABLE_ORDER
from scripts.restore_json_export_dry_run import RESTORE_TABLE_ORDER
from scripts.validate_json_export import REQUIRED_TABLES


SHARED_MARKET_TABLES = {
    "market_prices",
    "market_price_history",
}


def test_user_recovery_registry_matches_user_owned_models():
    user_owned_tables = {
        table_name
        for table_name, table in Base.metadata.tables.items()
        if "user_id" in table.columns
    }

    assert (
        set(USER_RECOVERY_TABLE_NAMES)
        | set(NON_RECOVERABLE_USER_TABLE_NAMES)
    ) == user_owned_tables
    assert not (
        set(USER_RECOVERY_TABLE_NAMES)
        & set(NON_RECOVERABLE_USER_TABLE_NAMES)
    )


def test_validation_restore_and_migration_use_authoritative_registry():
    all_model_tables = set(Base.metadata.tables)

    assert tuple(REQUIRED_TABLES) == USER_RECOVERY_TABLE_NAMES
    assert tuple(RESTORE_TABLE_ORDER) == USER_RECOVERY_TABLE_NAMES
    assert tuple(TABLE_ORDER) == MIGRATION_TABLE_ORDER
    assert set(MIGRATION_TABLE_ORDER) == all_model_tables
    assert (
        set(MIGRATION_TABLE_ORDER) - set(USER_RECOVERY_TABLE_NAMES)
        == SHARED_MARKET_TABLES
        | set(NON_RECOVERABLE_USER_TABLE_NAMES)
    )
