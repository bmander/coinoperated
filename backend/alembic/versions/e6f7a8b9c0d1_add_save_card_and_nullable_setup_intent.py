"""add save_card and nullable setup_intent

Revision ID: e6f7a8b9c0d1
Revises: d5f6a7b8c9e0
Create Date: 2026-02-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5f6a7b8c9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("pledge", "setup_intent", nullable=True)
    op.add_column(
        "pledge",
        sa.Column("save_card", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("pledge", "save_card")
    op.alter_column("pledge", "setup_intent", nullable=False)
