from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from typing import List
from enum import Enum


class PurchaseStatus(str, Enum):
    PENDING = "PENDING"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class PurchaseStatusUpdate(BaseModel):
    status: PurchaseStatus


class PurchaseItemCreate(BaseModel):
    product_id: int

    quantity: int = Field(gt=0)

    unit_price: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2
    )


from datetime import datetime

class PurchaseCreate(BaseModel):
    supplier_id: int
    po_number: str
    order_date: datetime
    expected_delivery_date: datetime | None = None
    tax_rate: Decimal | None = None
    discount_rate: Decimal | None = None
    shipping_charges: Decimal | None = None
    payment_terms: str | None = None
    delivery_address: str | None = None
    notes: str | None = None
    items: List[PurchaseItemCreate]


class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


class PurchaseResponse(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    user_id: int
    order_date: datetime
    expected_delivery_date: datetime | None
    tax_rate: Decimal | None
    discount_rate: Decimal | None
    shipping_charges: Decimal | None
    payment_terms: str | None
    delivery_address: str | None
    total_amount: Decimal
    status: str
    notes: str | None

    purchase_items: List[PurchaseItemResponse]

    model_config = ConfigDict(from_attributes=True)