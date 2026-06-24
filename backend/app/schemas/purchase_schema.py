from pydantic import BaseModel, Field, ConfigDict
from typing import List


class PurchaseItemCreate(BaseModel):
    product_id: int

    quantity: int = Field(
        gt=0
    )

    unit_price: float = Field(
        gt=0
    )


class PurchaseCreate(BaseModel):
    supplier_id: int

    notes: str | None = None

    items: List[PurchaseItemCreate]


class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    subtotal: float

    model_config = ConfigDict(
        from_attributes=True
    )


class PurchaseResponse(BaseModel):
    id: int
    supplier_id: int
    user_id: int
    total_amount: float
    status: str

    purchase_items: List[PurchaseItemResponse]

    model_config = ConfigDict(
        from_attributes=True
    )