from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from typing import List, Optional
from datetime import datetime
from enum import Enum
from app.schemas.payment_schema import PaymentResponse


class InvoiceStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    VOID = "VOID"


class InvoiceItemResponse(BaseModel):
    id: int
    invoice_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    discount: Decimal
    tax: Decimal
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    sales_order_id: int
    customer_id: Optional[int] = None
    issue_date: datetime
    due_date: Optional[datetime] = None
    
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    shipping_charge: Decimal
    total_amount: Decimal
    
    amount_paid: Decimal
    balance_due: Decimal
    
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    status: InvoiceStatus
    
    created_by: int
    created_at: datetime
    updated_at: datetime

    invoice_items: List[InvoiceItemResponse] = []
    payments: List[PaymentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class InvoiceGenerateRequest(BaseModel):
    sales_order_id: int
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
