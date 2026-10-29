"""Database bootstrap and initialization script.

Initializes tables using SQLAlchemy models and seeds default roles.
Can be run locally or against a hosted database (such as Neon PostgreSQL).
"""
import os
import sys
from dotenv import load_dotenv

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

load_dotenv()

from app.database.database import engine, Base, SessionLocal
from app.models.role_model import Role
from app.models.user_model import User
from app.models.category_model import Category
from app.models.supplier_model import Supplier
from app.models.product_model import Product
from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.inventory_log_model import InventoryLog
from app.models.customer_model import Customer
from app.models.invoice_model import Invoice, InvoiceItem
from app.models.payment_model import Payment
from app.models.sales_return_model import SalesReturn, SalesReturnItem
from app.models.purchase_return_model import PurchaseReturn, PurchaseReturnItem
from app.models.notification_model import Notification
from app.models.system_setting_model import SystemSetting
from app.models.package_model import Package
from app.models.shipment_model import Shipment

from sqlalchemy import text


def init_database():
    print("1. Creating database tables if they do not exist...")
    Base.metadata.create_all(bind=engine)
    print("   Tables verified.")

    print("2. Checking default roles...")
    db = SessionLocal()
    try:
        roles_count = db.query(Role).count()
        if roles_count == 0:
            print("   Seeding default roles ('admin', 'user')...")
            admin_role = Role(id=1, name="admin", description="Administrator")
            user_role = Role(id=2, name="user", description="Standard User")
            db.add_all([admin_role, user_role])
            db.commit()
            print("   Default roles seeded successfully.")
        else:
            print(f"   Found {roles_count} existing roles.")
    finally:
        db.close()

    print("3. Stamping Alembic version to current head (e8c9d0f1a234)...")
    try:
        with engine.begin() as conn:
            # Check or create alembic_version table
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            ))
            current_version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
            if not current_version:
                conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('e8c9d0f1a234')"))
                print("   Stamped alembic_version with 'e8c9d0f1a234'.")
            else:
                print(f"   alembic_version is currently: {current_version}")
    except Exception as e:
        print(f"   Note on alembic_version stamp: {e}")

    print("\nInitialization complete! Database is ready.")


if __name__ == "__main__":
    init_database()
