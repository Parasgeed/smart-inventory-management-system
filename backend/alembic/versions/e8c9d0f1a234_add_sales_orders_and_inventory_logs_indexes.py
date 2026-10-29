"""add_sales_orders_and_inventory_logs_indexes

Revision ID: e8c9d0f1a234
Revises: 7fe38896a49c
Create Date: 2026-10-22 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8c9d0f1a234'
down_revision: Union[str, Sequence[str], None] = '7fe38896a49c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add query performance indexes for sales history and stockout aggregation."""
    op.create_index(
        'ix_sales_orders_status_sale_date',
        'sales_orders',
        ['status', 'sale_date'],
        unique=False
    )
    op.create_index(
        'ix_sales_order_items_product_order',
        'sales_order_items',
        ['product_id', 'sales_order_id'],
        unique=False
    )
    op.create_index(
        'ix_inventory_logs_product_timestamp',
        'inventory_logs',
        ['product_id', 'timestamp'],
        unique=False
    )
    op.create_index(
        'ix_sales_returns_order_id',
        'sales_returns',
        ['sales_order_id'],
        unique=False
    )
    op.create_index(
        'ix_sales_return_items_product_return',
        'sales_return_items',
        ['product_id', 'sales_return_id'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema: Drop performance indexes."""
    op.drop_index('ix_sales_return_items_product_return', table_name='sales_return_items')
    op.drop_index('ix_sales_returns_order_id', table_name='sales_returns')
    op.drop_index('ix_inventory_logs_product_timestamp', table_name='inventory_logs')
    op.drop_index('ix_sales_order_items_product_order', table_name='sales_order_items')
    op.drop_index('ix_sales_orders_status_sale_date', table_name='sales_orders')
