"""add pending pledge status and nullable payment_method

Revision ID: a3f1b2c4d5e6
Revises: caba9a0a51ab
Create Date: 2026-02-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3f1b2c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'caba9a0a51ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'pending' to pledge_status enum
    op.execute("ALTER TYPE pledge_status ADD VALUE IF NOT EXISTS 'pending'")
    # Make payment_method nullable
    op.alter_column('pledge', 'payment_method', nullable=True)
    # Update server_default to 'pending'
    op.alter_column('pledge', 'status', server_default='pending')


def downgrade() -> None:
    op.alter_column('pledge', 'status', server_default='active')
    op.alter_column('pledge', 'payment_method', nullable=False)
    # Note: PostgreSQL does not support removing values from enums directly.
    # A full enum recreation would be needed for a complete downgrade.
