from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from typing import List


class SaleItemCreate(BaseModel):
    product_id: int

    quantity: int = Field(gt=0)

    unit_price: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2
    )


class SaleCreate(BaseModel):
    customer_name: str | None = None
    payment_method: str | None = None
    items: List[SaleItemCreate]


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    cost_price_at_sale: Decimal | None = None
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


class SaleResponse(BaseModel):
    id: int
    user_id: int
    customer_name: str | None
    payment_method: str | None
    total_amount: Decimal

    sale_items: List[SaleItemResponse]

    model_config = ConfigDict(from_attributes=True)