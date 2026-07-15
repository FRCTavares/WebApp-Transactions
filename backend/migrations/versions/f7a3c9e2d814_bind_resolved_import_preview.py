"""bind resolved import preview

Revision ID: f7a3c9e2d814
Revises: c6a8d1e4f920
Create Date: 2026-07-15 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a3c9e2d814"
down_revision: Union[str, Sequence[str], None] = "c6a8d1e4f920"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "import_previews"
COLUMN_NAME = "resolved_payload_sha256"
CONSTRAINT_NAME = "ck_import_previews_resolved_sha256_length"


def _column_exists() -> bool:
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table(TABLE_NAME):
        return False

    return any(
        column["name"] == COLUMN_NAME
        for column in inspector.get_columns(TABLE_NAME)
    )


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table(TABLE_NAME):
        raise RuntimeError(
            f"Required table does not exist: {TABLE_NAME}"
        )

    if not _column_exists():
        with op.batch_alter_table(TABLE_NAME) as batch_op:
            batch_op.add_column(
                sa.Column(
                    COLUMN_NAME,
                    sa.String(length=64),
                    nullable=True,
                )
            )
            batch_op.create_check_constraint(
                CONSTRAINT_NAME,
                (
                    f"{COLUMN_NAME} IS NULL OR "
                    f"length({COLUMN_NAME}) = 64"
                ),
            )


def downgrade() -> None:
    if _column_exists():
        with op.batch_alter_table(TABLE_NAME) as batch_op:
            batch_op.drop_constraint(
                CONSTRAINT_NAME,
                type_="check",
            )
            batch_op.drop_column(COLUMN_NAME)
