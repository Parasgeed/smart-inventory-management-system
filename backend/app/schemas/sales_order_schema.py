from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from typing import List, Optional
from datetime import datetime
from enum import Enum


class SalesOrderStatus(str, Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PACKED = "PACKED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PackageStatus(str, Enum):
    PACKED = "PACKED"
    SHIPPED = "SHIPPED"


class SalesOrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)


class SalesOrderCreate(BaseModel):
    customer_id: Optional[int] = None
    payment_method: Optional[str] = None
    items: List[SalesOrderItemCreate]


class SalesOrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    cost_price_at_sale: Optional[Decimal] = None
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


class ShipmentResponse(BaseModel):
    id: int
    package_id: int
    tracking_number: str
    courier: str
    shipped_date: datetime

    model_config = ConfigDict(from_attributes=True)


class PackageResponse(BaseModel):
    id: int
    sales_order_id: int
    package_number: str
    status: PackageStatus
    created_at: datetime
    shipments: List[ShipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SalesOrderResponse(BaseModel):
    id: int
    user_id: int
    customer_id: Optional[int] = None
    status: SalesOrderStatus
    payment_method: Optional[str]
    total_amount: Decimal
    sale_date: datetime

    sales_order_items: List[SalesOrderItemResponse] = []
    packages: List[PackageResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SalesOrderStatusUpdate(BaseModel):
    status: SalesOrderStatus


class PackageCreate(BaseModel):
    package_number: str


class ShipmentCreate(BaseModel):
    tracking_number: str
    courier: str
