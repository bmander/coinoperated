"""add email preferences

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_preference",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("patron_id", sa.UUID(), sa.ForeignKey("patron.id"), nullable=False),
        sa.Column(
            "notification_type",
            postgresql.ENUM(
                "task_accepted",
                "task_review_started",
                "task_completed",
                "task_declined",
                "charge_succeeded",
                "charge_failed",
                name="notification_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("patron_id", "notification_type"),
    )


def downgrade() -> None:
    op.drop_table("email_preference")
