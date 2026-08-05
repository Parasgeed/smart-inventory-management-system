import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

# Make the `app` package importable when Alembic runs from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from app.database.database import Base

# Import every model so Base.metadata is fully populated —
# Alembic can only "see" tables whose model classes have been imported.
from app.models.role_model import Role
from app.models.user_model import User
from app.models.supplier_model import Supplier
from app.models.category_model import Category
from app.models.product_model import Product
from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.package_model import Package
from app.models.shipment_model import Shipment
from app.models.inventory_log_model import InventoryLog
from app.models.system_setting_model import SystemSetting
from app.models.customer_model import Customer
from app.models.invoice_model import Invoice, InvoiceItem
from app.models.payment_model import Payment
from app.models.notification_model import Notification

config = context.config
db_url = os.getenv("DATABASE_URL")
config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()