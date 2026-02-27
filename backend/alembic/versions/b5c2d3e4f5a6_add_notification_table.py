"""add notification table

Revision ID: b5c2d3e4f5a6
Revises: a3f1b2c4d5e6
Create Date: 2026-02-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'b5c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a3f1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    notification_type = sa.Enum(
        'task_accepted', 'task_completed', 'task_declined',
        name='notification_type',
    )
    notification_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'notification',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('patron_id', UUID(as_uuid=True), sa.ForeignKey('patron.id'), nullable=False),
        sa.Column('task_id', UUID(as_uuid=True), sa.ForeignKey('task.id'), nullable=False),
        sa.Column('event', notification_type, nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('notification')
    sa.Enum(name='notification_type').drop(op.get_bind(), checkfirst=True)
