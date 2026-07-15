"""add relational foreign keys

Revision ID: f4b8c2d6e913
Revises: e2f7a9c4d610
Create Date: 2026-07-14 19:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4b8c2d6e913"
down_revision: Union[str, Sequence[str], None] = "e2f7a9c4d610"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RELATIONSHIPS: list[
    tuple[str, str, str, str, str, str]
] = [
    (
        "transactions",
        "fk_transactions_import_batch_id_import_batches",
        "import_batch_id",
        "import_batches",
        "id",
        "RESTRICT",
    ),
    (
        "investment_events",
        "fk_investment_events_transaction_id_transactions",
        "transaction_id",
        "transactions",
        "id",
        "SET NULL",
    ),
    (
        "investment_events",
        "fk_investment_events_matched_transaction_id_transactions",
        "matched_transaction_id",
        "transactions",
        "id",
        "SET NULL",
    ),
    (
        "investment_events",
        "fk_investment_events_import_batch_id_import_batches",
        "import_batch_id",
        "import_batches",
        "id",
        "RESTRICT",
    ),
    (
        "owed_items",
        "fk_owed_items_linked_transaction_id_transactions",
        "linked_transaction_id",
        "transactions",
        "id",
        "RESTRICT",
    ),
    (
        "owed_items",
        "fk_owed_items_import_batch_id_import_batches",
        "import_batch_id",
        "import_batches",
        "id",
        "RESTRICT",
    ),
    (
        "owed_payments",
        "fk_owed_payments_linked_transaction_id_transactions",
        "linked_transaction_id",
        "transactions",
        "id",
        "RESTRICT",
    ),
    (
        "owed_payment_allocations",
        "fk_owed_payment_allocations_owed_payment_id_owed_payments",
        "owed_payment_id",
        "owed_payments",
        "id",
        "CASCADE",
    ),
    (
        "owed_payment_allocations",
        "fk_owed_payment_allocations_owed_item_id_owed_items",
        "owed_item_id",
        "owed_items",
        "id",
        "RESTRICT",
    ),
    (
        "wealth_snapshots",
        "fk_wealth_snapshots_account_id_wealth_accounts",
        "account_id",
        "wealth_accounts",
        "id",
        "RESTRICT",
    ),
    (
        "wealth_snapshots",
        "fk_wealth_snapshots_import_batch_id_import_batches",
        "import_batch_id",
        "import_batches",
        "id",
        "RESTRICT",
    ),
]


def _require_schema() -> None:
    inspector = sa.inspect(op.get_bind())
    table_names = set(inspector.get_table_names())

    for (
        child_table,
        _constraint_name,
        child_column,
        parent_table,
        parent_column,
        _ondelete,
    ) in RELATIONSHIPS:
        if child_table not in table_names:
            raise RuntimeError(
                f"Required relationship table does not exist: {child_table}"
            )

        if parent_table not in table_names:
            raise RuntimeError(
                f"Required relationship table does not exist: {parent_table}"
            )

        child_columns = {
            column["name"]
            for column in inspector.get_columns(child_table)
        }
        parent_columns = {
            column["name"]
            for column in inspector.get_columns(parent_table)
        }

        if child_column not in child_columns:
            raise RuntimeError(
                f"Required relationship column does not exist: "
                f"{child_table}.{child_column}"
            )

        if parent_column not in parent_columns:
            raise RuntimeError(
                f"Required relationship column does not exist: "
                f"{parent_table}.{parent_column}"
            )

        if "user_id" not in child_columns:
            raise RuntimeError(
                f"Required ownership column does not exist: "
                f"{child_table}.user_id"
            )

        if "user_id" not in parent_columns:
            raise RuntimeError(
                f"Required ownership column does not exist: "
                f"{parent_table}.user_id"
            )


def _count_violations(
    child_table: str,
    child_column: str,
    parent_table: str,
    parent_column: str,
) -> tuple[int, int]:
    connection = op.get_bind()

    orphan_count = int(
        connection.scalar(
            sa.text(
                f"""
                SELECT COUNT(*)
                FROM {child_table} AS child
                LEFT JOIN {parent_table} AS parent
                  ON parent.{parent_column} = child.{child_column}
                WHERE child.{child_column} IS NOT NULL
                  AND parent.{parent_column} IS NULL
                """
            )
        )
        or 0
    )

    cross_user_count = int(
        connection.scalar(
            sa.text(
                f"""
                SELECT COUNT(*)
                FROM {child_table} AS child
                JOIN {parent_table} AS parent
                  ON parent.{parent_column} = child.{child_column}
                WHERE child.{child_column} IS NOT NULL
                  AND child.user_id != parent.user_id
                """
            )
        )
        or 0
    )

    return orphan_count, cross_user_count


def _preflight_relationships() -> None:
    violations: list[str] = []

    for (
        child_table,
        _constraint_name,
        child_column,
        parent_table,
        parent_column,
        _ondelete,
    ) in RELATIONSHIPS:
        orphan_count, cross_user_count = _count_violations(
            child_table=child_table,
            child_column=child_column,
            parent_table=parent_table,
            parent_column=parent_column,
        )

        if orphan_count:
            violations.append(
                f"{child_table}.{child_column}: "
                f"{orphan_count} orphaned reference(s)"
            )

        if cross_user_count:
            violations.append(
                f"{child_table}.{child_column}: "
                f"{cross_user_count} cross-user reference(s)"
            )

    if violations:
        details = "; ".join(violations)
        raise RuntimeError(
            "Relational foreign-key migration preflight failed: "
            + details
        )


def upgrade() -> None:
    _require_schema()
    _preflight_relationships()

    relationships_by_table: dict[
        str,
        list[tuple[str, str, str, str, str]],
    ] = {}

    for (
        child_table,
        constraint_name,
        child_column,
        parent_table,
        parent_column,
        ondelete,
    ) in RELATIONSHIPS:
        relationships_by_table.setdefault(child_table, []).append(
            (
                constraint_name,
                child_column,
                parent_table,
                parent_column,
                ondelete,
            )
        )

    for child_table, relationships in relationships_by_table.items():
        with op.batch_alter_table(child_table) as batch_op:
            for (
                constraint_name,
                child_column,
                parent_table,
                parent_column,
                ondelete,
            ) in relationships:
                batch_op.create_foreign_key(
                    constraint_name,
                    parent_table,
                    [child_column],
                    [parent_column],
                    ondelete=ondelete,
                )


def downgrade() -> None:
    relationships_by_table: dict[str, list[str]] = {}

    for (
        child_table,
        constraint_name,
        _child_column,
        _parent_table,
        _parent_column,
        _ondelete,
    ) in reversed(RELATIONSHIPS):
        relationships_by_table.setdefault(child_table, []).append(
            constraint_name
        )

    for child_table, constraint_names in relationships_by_table.items():
        with op.batch_alter_table(child_table) as batch_op:
            for constraint_name in constraint_names:
                batch_op.drop_constraint(
                    constraint_name,
                    type_="foreignkey",
                )
