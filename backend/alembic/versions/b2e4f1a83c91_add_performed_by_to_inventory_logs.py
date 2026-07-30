"""add performed_by to inventory_logs

Revision ID: b2e4f1a83c91
Revises: a1f3c9d02b47
Create Date: 2026-07-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2e4f1a83c91'
down_revision: Union[str, Sequence[str], None] = "1d37b283323f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable intentionally: existing inventory_log rows predate this column
    # and cannot be backfilled (we don't know who triggered them).
    # All new rows written by adjust_stock() will populate this field.
    op.add_column(
        'inventory_logs',
        sa.Column(
            'performed_by',
            sa.Integer(),
            sa.ForeignKey('users.id'),
            nullable=True
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('inventory_logs', 'performed_by')