"""add ideation status and comment table

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE must be committed before the new value can be used,
    # so run it outside the main transaction.
    op.execute("COMMIT")
    op.execute("ALTER TYPE task_status ADD VALUE 'ideation' BEFORE 'proposed'")
    op.execute("BEGIN")

    op.create_table(
        "comment",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("task_id", sa.UUID(), sa.ForeignKey("task.id"), nullable=False),
        sa.Column("author_id", sa.UUID(), sa.ForeignKey("patron.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_comment_task_id", "comment", ["task_id"])

    op.alter_column("task", "status", server_default="ideation")


def downgrade() -> None:
    op.alter_column("task", "status", server_default="proposed")
    op.drop_index("ix_comment_task_id", table_name="comment")
    op.drop_table("comment")
    # Note: PostgreSQL does not support removing enum values
