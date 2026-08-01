import re

file_path = 'c:/Users/paras/Documents/smart-inventory-management-system/backend/alembic/versions/cf086c248276_refactor_sales_to_salesorders.py'

with open(file_path, 'r') as f:
    content = f.read()

# We need to replace the creation and dropping of sales and sale_items with rename and alter.
upgrade_logic = """
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
"""

downgrade_logic = """
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
"""

# Replace upgrade body
content = re.sub(r'def upgrade\(\) -> None:.*?def downgrade\(\) -> None:', 
                 'def upgrade() -> None:\n' + upgrade_logic + '\n\ndef downgrade() -> None:', 
                 content, flags=re.DOTALL)

# Replace downgrade body
content = re.sub(r'def downgrade\(\) -> None:.*', 
                 'def downgrade() -> None:\n' + downgrade_logic, 
                 content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)

print("Migration file updated.")
