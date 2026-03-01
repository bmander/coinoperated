"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "patron",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("stripe_customer", sa.Text(), nullable=False),
        sa.Column("default_payment_method", sa.Text(), nullable=True),
        sa.Column("is_banned", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "magic_link_token",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_table(
        "task",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("criteria", sa.Text(), nullable=True),
        sa.Column("submitted_by", sa.UUID(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("proposed", "underway", "collecting", "completed", "declined", name="task_status"),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("pledge_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("pledge_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("collected_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("underway_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["submitted_by"], ["patron.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "pledge",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patron_id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("payment_method", sa.Text(), nullable=True),
        sa.Column("setup_intent", sa.Text(), nullable=True),
        sa.Column("save_card", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "active", "collected", "failed", "released", name="pledge_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("payment_intent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("amount >= 100", name="pledge_minimum_amount"),
        sa.ForeignKeyConstraint(["patron_id"], ["patron.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["task.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("patron_id", "task_id"),
    )
    op.create_table(
        "update",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["task.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "notification",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("patron_id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "task_accepted", "task_completed", "task_declined",
                "charge_succeeded", "charge_failed",
                name="notification_type",
            ),
            nullable=False,
        ),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("email_sent", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patron_id"], ["patron.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["task.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("notification")
    op.drop_table("update")
    op.drop_table("pledge")
    op.drop_table("task")
    op.drop_table("magic_link_token")
    op.drop_table("patron")
    sa.Enum(name="task_status").drop(op.get_bind())
    sa.Enum(name="pledge_status").drop(op.get_bind())
    sa.Enum(name="notification_type").drop(op.get_bind())
