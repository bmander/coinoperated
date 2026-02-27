"""lower pledge minimum to 100

Revision ID: d5f6a7b8c9e0
Revises: caba9a0a51ab
Create Date: 2026-02-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5f6a7b8c9e0"
down_revision: Union[str, None] = "caba9a0a51ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("pledge_minimum_amount", "pledge", type_="check")
    op.create_check_constraint("pledge_minimum_amount", "pledge", "amount >= 100")


def downgrade() -> None:
    op.drop_constraint("pledge_minimum_amount", "pledge", type_="check")
    op.create_check_constraint("pledge_minimum_amount", "pledge", "amount >= 500")
