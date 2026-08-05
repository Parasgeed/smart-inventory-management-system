from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PurchaseReturnItemBase(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    refund_amount: float
    reason: Optional[str] = None

class PurchaseReturnItemCreate(PurchaseReturnItemBase):
    pass

class PurchaseReturnItemResponse(PurchaseReturnItemBase):
    id: int
    purchase_return_id: int

    class Config:
        from_attributes = True

class PurchaseReturnBase(BaseModel):
    purchase_id: int
    notes: Optional[str] = None

class PurchaseReturnCreate(PurchaseReturnBase):
    items: List[PurchaseReturnItemCreate]

class PurchaseReturnResponse(PurchaseReturnBase):
    id: int
    return_date: datetime
    status: str
    total_refund_amount: float
    created_by: int
    return_items: List[PurchaseReturnItemResponse] = []

    class Config:
        from_attributes = True
