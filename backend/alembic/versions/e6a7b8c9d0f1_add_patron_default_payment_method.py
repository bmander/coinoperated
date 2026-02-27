"""add patron default_payment_method

Revision ID: e6a7b8c9d0f1
Revises: d5f6a7b8c9e0
Create Date: 2026-02-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e6a7b8c9d0f1"
down_revision: Union[str, None] = "d5f6a7b8c9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patron", sa.Column("default_payment_method", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("patron", "default_payment_method")
