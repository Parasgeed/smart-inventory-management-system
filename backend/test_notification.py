import datetime
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.notification_model import Notification
from app.models.user_model import User
from app.models.role_model import Role
from app.models.purchase_model import Purchase
from app.models.sales_order_model import SalesOrder
from app.models.product_model import Product
from app.models.category_model import Category
from app.models.supplier_model import Supplier
from app.models.customer_model import Customer
from app.models.inventory_log_model import InventoryLog
from app.models.invoice_model import Invoice
from app.models.payment_model import Payment

def create_test_notification():
    db = SessionLocal()
    try:
        new_notif = Notification(
            user_id=1,
            type='LOW_STOCK',
            title='Test Notification from Python!',
            message='This is a test notification injected to demonstrate the feature.',
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(new_notif)
        db.commit()
        print("Notification created successfully for user_id 1")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_test_notification()
