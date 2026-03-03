"""add review status

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE task_status ADD VALUE 'review' AFTER 'underway'")
    op.execute("ALTER TYPE notification_type ADD VALUE 'task_review_started' AFTER 'task_accepted'")
    op.add_column("task", sa.Column("review_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("task", "review_at")
    # PostgreSQL does not support removing values from enums.
    # To fully downgrade, recreate the enum types manually.
