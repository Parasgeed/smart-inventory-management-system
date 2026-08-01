from fastapi import FastAPI

from app.database.database import engine, Base

from app.models.role_model import Role
from app.models.user_model import User
from app.models.supplier_model import Supplier
from app.models.category_model import Category
from app.models.product_model import Product
from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.inventory_log_model import InventoryLog
from app.models.customer_model import Customer

from app.routes.auth_routes import router as auth_router

from app.routes.product_routes import router as product_router

from app.routes.supplier_routes import router as supplier_router

from app.routes.category_routes import router as category_router

from app.routes.purchase_routes import router as purchase_router

from app.routes.sales_order_routes import router as sales_order_router
from app.routes.customer_routes import router as customer_router

from app.routes.dashboard_routes import router as dashboard_router

from app.routes.report_routes import router as report_router

from app.routes.inventory_log_routes import router as inventory_log_router

from app.routes.settings_routes import router as settings_router

from fastapi import FastAPI, APIRouter

app = FastAPI()

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(product_router)
api_router.include_router(supplier_router)
api_router.include_router(category_router)

api_router.include_router(purchase_router)
api_router.include_router(sales_order_router)  # Include the sales order router
api_router.include_router(customer_router)
api_router.include_router(dashboard_router)    
api_router.include_router(report_router)
api_router.include_router(inventory_log_router)
api_router.include_router(settings_router)

app.include_router(api_router)

@app.get("/")
def home():
    return {
        "message": "Inventory Management Backend Running"
    }

