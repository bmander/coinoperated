"""add patron is_banned

Revision ID: c5f1a2b3d4e5
Revises: b4e7f8a9c0d1
Create Date: 2026-02-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c5f1a2b3d4e5'
down_revision: Union[str, Sequence[str], None] = 'b4e7f8a9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'patron',
        sa.Column('is_banned', sa.Boolean(), server_default='false', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('patron', 'is_banned')
