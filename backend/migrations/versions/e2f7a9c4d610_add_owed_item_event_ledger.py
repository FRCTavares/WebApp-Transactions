"""add owed item event ledger

Revision ID: e2f7a9c4d610
Revises: d9e4f6a2b731
Create Date: 2026-07-14 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f7a9c4d610"
down_revision: Union[str, Sequence[str], None] = "d9e4f6a2b731"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EVENT_TABLE = "owed_item_events"


def _table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False

    return any(
        column["name"] == column_name
        for column in sa.inspect(op.get_bind()).get_columns(table_name)
    )


def upgrade() -> None:
    if not _table_exists("owed_items"):
        raise RuntimeError("Required table does not exist: owed_items")

    if not _column_exists("owed_items", "deleted_at"):
        with op.batch_alter_table("owed_items") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "deleted_at",
                    sa.DateTime(timezone=True),
                    nullable=True,
                )
            )
            batch_op.create_index(
                "ix_owed_items_deleted_at",
                ["deleted_at"],
                unique=False,
            )

    if not _table_exists(EVENT_TABLE):
        op.create_table(
            EVENT_TABLE,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.String(length=100), nullable=False),
            sa.Column("owed_item_id", sa.Integer(), nullable=False),
            sa.Column("owed_payment_id", sa.Integer(), nullable=True),
            sa.Column("event_type", sa.String(length=30), nullable=False),
            sa.Column("effective_date", sa.Date(), nullable=False),
            sa.Column("amount_total", sa.Numeric(12, 2), nullable=False),
            sa.Column("amount_paid", sa.Numeric(12, 2), nullable=False),
            sa.Column("amount_remaining", sa.Numeric(12, 2), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.CheckConstraint(
                "event_type IN ("
                "'created', "
                "'adjusted', "
                "'payment', "
                "'payment_reversed', "
                "'cancelled', "
                "'reopened', "
                "'deleted'"
                ")",
                name="ck_owed_item_events_event_type_known",
            ),
            sa.CheckConstraint(
                "amount_total > 0",
                name="ck_owed_item_events_amount_total_positive",
            ),
            sa.CheckConstraint(
                "amount_paid >= 0",
                name="ck_owed_item_events_amount_paid_non_negative",
            ),
            sa.CheckConstraint(
                "amount_remaining >= 0",
                name="ck_owed_item_events_amount_remaining_non_negative",
            ),
            sa.CheckConstraint(
                "abs((amount_paid + amount_remaining) - amount_total) <= 0.01",
                name="ck_owed_item_events_balance_consistent",
            ),
            sa.CheckConstraint(
                "status IN ('open', 'partially_paid', 'paid', 'cancelled')",
                name="ck_owed_item_events_status_known",
            ),
            sa.ForeignKeyConstraint(
                ["owed_item_id"],
                ["owed_items.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
        )

        op.create_index(
            "ix_owed_item_events_id",
            EVENT_TABLE,
            ["id"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_user_id",
            EVENT_TABLE,
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_owed_item_id",
            EVENT_TABLE,
            ["owed_item_id"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_owed_payment_id",
            EVENT_TABLE,
            ["owed_payment_id"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_event_type",
            EVENT_TABLE,
            ["event_type"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_effective_date",
            EVENT_TABLE,
            ["effective_date"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_status",
            EVENT_TABLE,
            ["status"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_user_effective_date",
            EVENT_TABLE,
            ["user_id", "effective_date"],
            unique=False,
        )
        op.create_index(
            "ix_owed_item_events_user_item_effective",
            EVENT_TABLE,
            ["user_id", "owed_item_id", "effective_date", "id"],
            unique=False,
        )

    op.execute(
        sa.text(
            """
            INSERT INTO owed_item_events (
                user_id,
                owed_item_id,
                owed_payment_id,
                event_type,
                effective_date,
                amount_total,
                amount_paid,
                amount_remaining,
                status,
                notes,
                created_at
            )
            SELECT
                item.user_id,
                item.id,
                NULL,
                'created',
                COALESCE(
                    linked_transaction.date,
                    item.due_date,
                    DATE(item.created_at)
                ),
                item.amount_total,
                item.amount_paid,
                item.amount_remaining,
                item.status,
                'Baseline event created during owed ledger migration.',
                item.created_at
            FROM owed_items AS item
            LEFT JOIN transactions AS linked_transaction
              ON linked_transaction.id = item.linked_transaction_id
             AND linked_transaction.user_id = item.user_id
            WHERE NOT EXISTS (
                SELECT 1
                FROM owed_item_events AS existing_event
                WHERE existing_event.user_id = item.user_id
                  AND existing_event.owed_item_id = item.id
            )
            """
        )
    )


def downgrade() -> None:
    if _table_exists(EVENT_TABLE):
        op.drop_table(EVENT_TABLE)

    if _column_exists("owed_items", "deleted_at"):
        with op.batch_alter_table("owed_items") as batch_op:
            batch_op.drop_index("ix_owed_items_deleted_at")
            batch_op.drop_column("deleted_at")
