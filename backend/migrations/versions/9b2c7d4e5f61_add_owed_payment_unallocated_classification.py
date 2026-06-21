"""add owed payment unallocated classification

Revision ID: 9b2c7d4e5f61
Revises: 8a1c9d2e4f30
Create Date: 2026-06-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b2c7d4e5f61"
down_revision: Union[str, Sequence[str], None] = "8a1c9d2e4f30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("owed_payments") as batch_op:
        batch_op.add_column(
            sa.Column("unallocated_category", sa.String(length=100), nullable=True)
        )
        batch_op.add_column(sa.Column("unallocated_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("owed_payments") as batch_op:
        batch_op.drop_column("unallocated_notes")
        batch_op.drop_column("unallocated_category")
