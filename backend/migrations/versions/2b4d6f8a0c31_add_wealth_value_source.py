"""add explicit wealth value source

Revision ID: 2b4d6f8a0c31
Revises: f7a3c9e2d814
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2b4d6f8a0c31"
down_revision: Union[str, Sequence[str], None] = "f7a3c9e2d814"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("wealth_accounts") as batch_op:
        batch_op.add_column(
            sa.Column(
                "value_source",
                sa.String(length=20),
                nullable=False,
                server_default="manual",
            )
        )
        batch_op.add_column(
            sa.Column("value_reference", sa.String(length=100), nullable=True)
        )
        batch_op.create_check_constraint(
            "ck_wealth_accounts_value_source_known",
            "value_source IN ('manual', 'investment', 'owed')",
        )
        batch_op.create_index("ix_wealth_accounts_value_source", ["value_source"])

    op.execute(
        """
        UPDATE wealth_accounts SET value_source = 'owed'
        WHERE lower(coalesce(name, '') || ' ' || coalesce(institution, '') || ' ' || coalesce(notes, ''))
          LIKE '%owed%'
        """
    )
    for symbol in ("CSPX", "VWCE", "BTC"):
        op.execute(
            sa.text(
                """
                UPDATE wealth_accounts
                SET value_source = 'investment', value_reference = :symbol
                WHERE value_source = 'manual'
                  AND upper(coalesce(name, '') || ' ' || coalesce(institution, '') || ' ' || coalesce(notes, ''))
                    LIKE :pattern
                """
            ).bindparams(symbol=symbol, pattern=f"%{symbol}%")
        )


def downgrade() -> None:
    with op.batch_alter_table("wealth_accounts") as batch_op:
        batch_op.drop_index("ix_wealth_accounts_value_source")
        batch_op.drop_constraint("ck_wealth_accounts_value_source_known", type_="check")
        batch_op.drop_column("value_reference")
        batch_op.drop_column("value_source")
