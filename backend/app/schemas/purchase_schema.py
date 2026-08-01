from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from typing import List
from enum import Enum
from datetime import datetime


class PurchaseStatus(str, Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class PurchaseStatusUpdate(BaseModel):
    status: PurchaseStatus


class PurchaseItemCreate(BaseModel):
    product_id: int

    ordered_quantity: int = Field(gt=0)

    unit_price: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2
    )


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
    ordered_quantity: int
    received_quantity: int
    remaining_quantity: int
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
    status: PurchaseStatus
    notes: str | None

    purchase_items: List[PurchaseItemResponse]

    model_config = ConfigDict(from_attributes=True)


class ReceiveItemRequest(BaseModel):
    product_id: int
    quantity_received: int = Field(gt=0)


class PurchaseReceiveRequest(BaseModel):
    items: List[ReceiveItemRequest]