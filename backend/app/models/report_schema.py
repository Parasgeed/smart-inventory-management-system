from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime


class SalesReportItem(BaseModel):
    sale_id: int
    sale_date: datetime
    customer_name: str
    payment_method: str
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    sale_total_amount: Decimal


class PurchasesReportItem(BaseModel):
    purchase_id: int
    purchase_date: datetime
    supplier_name: str
    status: str
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    purchase_total_amount: Decimal


class InventoryReportItem(BaseModel):
    product_id: int
    name: str
    sku: str
    category: str
    supplier: str
    quantity: int
    reorder_level: int
    cost_price: Decimal
    selling_price: Decimal
    inventory_value: Decimal


class ProfitLossReportItem(BaseModel):
    sale_id: int
    sale_date: datetime
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    cost_price_at_sale: Decimal
    revenue: Decimal
    cost: Decimal
    profit: Decimal
    margin_pct: Decimal


class StockValuationReportItem(BaseModel):
    category_id: int | None
    category_name: str
    product_count: int
    total_quantity: int
    total_value: Decimal


class AuditTrailReportItem(BaseModel):
    log_id: int
    timestamp: datetime
    product_id: int
    product_name: str
    change_type: str
    reference_type: str | None
    reference_id: int | None
    quantity_changed: int
    previous_quantity: int
    new_quantity: int