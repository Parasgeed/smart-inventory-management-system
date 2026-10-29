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
from app.models.sales_return_model import SalesReturn, SalesReturnItem
from app.models.purchase_return_model import PurchaseReturn, PurchaseReturnItem
from app.models.notification_model import Notification

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

from app.routes.invoice_routes import router as invoice_router
from app.routes.payment_routes import router as payment_router
from app.routes.sales_return_routes import router as sales_return_router
from app.routes.purchase_return_routes import router as purchase_return_router
from app.routes.search_routes import router as search_router
from app.routes.notification_routes import router as notification_router
from app.routes.test_routes import router as test_router
from app.routes.forecast_routes import router as forecast_router

import os
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

app = FastAPI(
    title="Smart Inventory Management System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Production-configurable CORS middleware
allowed_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
)
origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

if "*" in origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(product_router)
api_router.include_router(supplier_router)
api_router.include_router(category_router)

api_router.include_router(purchase_router)
api_router.include_router(purchase_return_router)
api_router.include_router(sales_order_router)  # Include the sales order router
api_router.include_router(customer_router)
api_router.include_router(invoice_router)
api_router.include_router(payment_router)
api_router.include_router(sales_return_router)
api_router.include_router(search_router)
api_router.include_router(dashboard_router)    
api_router.include_router(report_router)
api_router.include_router(inventory_log_router)
api_router.include_router(settings_router)
api_router.include_router(notification_router)
api_router.include_router(test_router)
api_router.include_router(forecast_router)


@app.get("/health", tags=["Health"])
@api_router.get("/health", tags=["Health"])
def health_check():
    """Liveness & readiness probe verifying database connectivity."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
        }
    except Exception:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": "Database connectivity check failed"
        }


app.include_router(api_router)

@app.get("/")
def home():
    return {
        "message": "Inventory Management Backend Running"
    }

