from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime


class DashboardSummaryResponse(BaseModel):
    total_products: int
    total_suppliers: int
    total_categories: int
    low_stock_count: int
    total_inventory_value: Decimal
    today_sales_total: Decimal
    today_sales_count: int


class DashboardActivityItem(BaseModel):
    type: str
    id: int
    reference: str
    amount: Decimal
    date: datetime


class TopSellingProductItem(BaseModel):
    product_id: int
    product_name: str
    total_quantity_sold: int
    total_revenue: Decimal


class TopPurchasedProductItem(BaseModel):
    product_id: int
    product_name: str
    total_quantity_purchased: int


class MonthlyTrendItem(BaseModel):
    month: str
    total_amount: Decimal
    count: int


class CategoryDistributionItem(BaseModel):
    category_id: int
    category_name: str
    product_count: int


class InventoryValueResponse(BaseModel):
    total_inventory_value: Decimal
    total_products: int

class DeadStockItem(BaseModel):

    product_id: int
    product_name: str
    sku: str
    quantity: int
    cost_price: Decimal
    stock_value: Decimal
    last_sold_at: datetime | None   # None means never sold
    days_since_last_sale: int | None  #