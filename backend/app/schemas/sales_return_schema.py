from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from typing import List, Optional
from datetime import datetime

class SalesReturnItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    refund_amount: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    reason: Optional[str] = None

class SalesReturnCreate(BaseModel):
    sales_order_id: int
    notes: Optional[str] = None
    items: List[SalesReturnItemCreate]

class SalesReturnItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    refund_amount: Decimal
    reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SalesReturnResponse(BaseModel):
    id: int
    sales_order_id: int
    return_date: datetime
    status: str
    notes: Optional[str] = None
    created_by: int
    total_refund_amount: Decimal
    items: List[SalesReturnItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
