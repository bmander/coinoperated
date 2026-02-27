"""merge heads: default_payment_method and save_card

Revision ID: a8be0880f90f
Revises: e6a7b8c9d0f1, e6f7a8b9c0d1
Create Date: 2026-02-27 15:25:15.663399

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8be0880f90f'
down_revision: Union[str, Sequence[str], None] = ('e6a7b8c9d0f1', 'e6f7a8b9c0d1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
