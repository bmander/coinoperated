"""add notification table

Revision ID: b4e7f8a9c0d1
Revises: a3f1b2c4d5e6
Create Date: 2026-02-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'b4e7f8a9c0d1'
down_revision: Union[str, Sequence[str], None] = 'a3f1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    notification_type = sa.Enum(
        'task_accepted', 'task_completed', 'task_declined',
        'charge_succeeded', 'charge_failed',
        name='notification_type',
    )
    notification_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'notification',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('patron_id', UUID(as_uuid=True), sa.ForeignKey('patron.id'), nullable=False),
        sa.Column('task_id', UUID(as_uuid=True), sa.ForeignKey('task.id'), nullable=False),
        sa.Column('type', notification_type, nullable=False),
        sa.Column('subject', sa.Text(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('email_sent', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('notification')
    sa.Enum(name='notification_type').drop(op.get_bind(), checkfirst=True)
