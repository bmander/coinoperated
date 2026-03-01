"""rename open to proposed, accepted to underway

Revision ID: f1a2b3c4d5e6
Revises: a8be0880f90f
Create Date: 2026-02-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "a8be0880f90f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE task_status RENAME VALUE 'open' TO 'proposed'")
    op.execute("ALTER TYPE task_status RENAME VALUE 'accepted' TO 'underway'")
    op.execute("ALTER TABLE task ALTER COLUMN status SET DEFAULT 'proposed'")
    op.execute("ALTER TABLE task RENAME COLUMN accepted_at TO underway_at")


def downgrade() -> None:
    op.execute("ALTER TABLE task RENAME COLUMN underway_at TO accepted_at")
    op.execute("ALTER TABLE task ALTER COLUMN status SET DEFAULT 'open'")
    op.execute("ALTER TYPE task_status RENAME VALUE 'underway' TO 'accepted'")
    op.execute("ALTER TYPE task_status RENAME VALUE 'proposed' TO 'open'")
