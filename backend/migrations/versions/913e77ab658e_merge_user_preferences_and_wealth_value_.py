"""merge user preferences and wealth value source heads

Revision ID: 913e77ab658e
Revises: 1a3d5e7f9b20, 2b4d6f8a0c31
Create Date: 2026-07-19 16:01:08.421009

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = '913e77ab658e'
down_revision: Union[str, Sequence[str], None] = ('1a3d5e7f9b20', '2b4d6f8a0c31')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
