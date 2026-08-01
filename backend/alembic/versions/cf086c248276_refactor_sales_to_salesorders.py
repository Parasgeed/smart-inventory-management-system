"""Refactor Sales to SalesOrders

Revision ID: cf086c248276
Revises: 6163c1eb0d3d
Create Date: 2026-08-02 02:28:40.410187

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'cf086c248276'
down_revision: Union[str, Sequence[str], None] = '6163c1eb0d3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # Rename tables
    op.rename_table('sales', 'sales_orders')
    op.rename_table('sale_items', 'sales_order_items')

    # Update columns for sales_orders
    op.add_column('sales_orders', sa.Column('status', sa.String(length=30), nullable=True))
    
    # Backfill status
    op.execute("UPDATE sales_orders SET status = 'COMPLETED'")
    op.alter_column('sales_orders', 'status', nullable=False)

    # Note: customer_name is dropped, but we keep customer_id which is already there.
    op.drop_column('sales_orders', 'customer_name')

    # Fix foreign key in sales_order_items
    op.alter_column('sales_order_items', 'sale_id', new_column_name='sales_order_id')

    # Create new tables
    op.create_table('packages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sales_order_id', sa.Integer(), nullable=False),
    sa.Column('package_number', sa.String(length=50), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('package_number')
    )
    op.create_index(op.f('ix_packages_id'), 'packages', ['id'], unique=False)
    
    op.create_table('shipments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('package_id', sa.Integer(), nullable=False),
    sa.Column('tracking_number', sa.String(length=100), nullable=False),
    sa.Column('courier', sa.String(length=100), nullable=False),
    sa.Column('shipped_date', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['package_id'], ['packages.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shipments_id'), 'shipments', ['id'], unique=False)


def downgrade() -> None:

    # Drop new tables
    op.drop_index(op.f('ix_shipments_id'), table_name='shipments')
    op.drop_table('shipments')
    op.drop_index(op.f('ix_packages_id'), table_name='packages')
    op.drop_table('packages')

    # Revert sales_order_items
    op.alter_column('sales_order_items', 'sales_order_id', new_column_name='sale_id')
    op.rename_table('sales_order_items', 'sale_items')

    # Revert sales_orders
    op.add_column('sales_orders', sa.Column('customer_name', sa.String(length=100), nullable=True))
    op.drop_column('sales_orders', 'status')
    op.rename_table('sales_orders', 'sales')
