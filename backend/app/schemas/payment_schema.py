from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from typing import Optional
from datetime import datetime
from enum import Enum


class PaymentMethod(str, Enum):
    CASH = "Cash"
    UPI = "UPI"
    CREDIT_CARD = "Credit Card"
    DEBIT_CARD = "Debit Card"
    BANK_TRANSFER = "Bank Transfer"
    CHEQUE = "Cheque"
    WALLET = "Wallet"


class PaymentCreate(BaseModel):
    payment_method: PaymentMethod
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    payment_reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    invoice_id: int
    payment_reference: Optional[str] = None
    payment_method: PaymentMethod
    payment_date: datetime
    amount: Decimal
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
