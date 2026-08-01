"""Update legacy PENDING status to DRAFT

Revision ID: 6163c1eb0d3d
Revises: 81e1ef382992
Create Date: 2026-08-02 01:58:42.709736

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6163c1eb0d3d'
down_revision: Union[str, Sequence[str], None] = '81e1ef382992'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update legacy PENDING status to DRAFT
    op.execute("UPDATE purchases SET status = 'DRAFT' WHERE status = 'PENDING'")


def downgrade() -> None:
    # Revert DRAFT back to PENDING (optional, but good for completeness)
    op.execute("UPDATE purchases SET status = 'PENDING' WHERE status = 'DRAFT'")
