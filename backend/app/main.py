from fastapi import FastAPI

from app.database.database import engine, Base

from app.models.role_model import Role
from app.models.user_model import User
from app.models.supplier_model import Supplier
from app.models.category_model import Category
from app.models.product_model import Product
from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.sale_model import Sale
from app.models.sale_item_model import SaleItem
from app.models.inventory_log_model import InventoryLog

from app.routes.auth_routes import router as auth_router

from app.routes.product_routes import router as product_router

from app.routes.supplier_routes import router as supplier_router

from app.routes.category_routes import router as category_router

from app.routes.purchase_routes import router as purchase_router


Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(auth_router)
app.include_router(product_router)
app.include_router(supplier_router)
app.include_router(category_router)

app.include_router(purchase_router)



@app.get("/")
def home():
    return {
        "message": "Inventory Management Backend Running"
    }

