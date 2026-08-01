"""Purchase Order workflow update

Revision ID: 81e1ef382992
Revises: 1fdaa41cad36
Create Date: 2026-08-02 01:53:39.328357

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '81e1ef382992'
down_revision: Union[str, Sequence[str], None] = '1fdaa41cad36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename quantity to ordered_quantity
    op.alter_column('purchase_items', 'quantity', new_column_name='ordered_quantity')
    
    # Add new columns as nullable first
    op.add_column('purchase_items', sa.Column('received_quantity', sa.Integer(), nullable=True))
    op.add_column('purchase_items', sa.Column('remaining_quantity', sa.Integer(), nullable=True))
    
    # Migrate data (old purchases were fully received automatically)
    op.execute("UPDATE purchase_items SET received_quantity = ordered_quantity, remaining_quantity = 0")
    
    # Set to NOT NULL
    op.alter_column('purchase_items', 'received_quantity', nullable=False)
    op.alter_column('purchase_items', 'remaining_quantity', nullable=False)


def downgrade() -> None:
    op.drop_column('purchase_items', 'remaining_quantity')
    op.drop_column('purchase_items', 'received_quantity')
    op.alter_column('purchase_items', 'ordered_quantity', new_column_name='quantity')
