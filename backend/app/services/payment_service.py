from sqlalchemy.orm import Session
from fastapi import HTTPException
from decimal import Decimal

from app.models.payment_model import Payment
from app.models.invoice_model import Invoice
from app.schemas.payment_schema import PaymentCreate
from app.schemas.invoice_schema import InvoiceStatus


class PaymentService:
    @staticmethod
    def record_payment(db: Session, invoice_id: int, payment_data: PaymentCreate) -> Payment:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
            
        if invoice.status == InvoiceStatus.VOID.value:
            raise HTTPException(status_code=400, detail="Cannot record payments for a VOID invoice")
            
        if invoice.status == InvoiceStatus.PAID.value:
            raise HTTPException(status_code=400, detail="Invoice is already fully paid")

        # Business Rule: Negative payments should NOT be allowed.
        if payment_data.amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

        # Business Rule: Overpayment should NOT be allowed.
        if payment_data.amount > invoice.balance_due:
            raise HTTPException(
                status_code=400, 
                detail=f"Payment amount ({payment_data.amount}) exceeds balance due ({invoice.balance_due})"
            )
            
        payment = Payment(
            invoice_id=invoice.id,
            payment_reference=payment_data.payment_reference,
            payment_method=payment_data.payment_method.value,
            amount=payment_data.amount,
            notes=payment_data.notes
        )
        db.add(payment)
        
        # Update Invoice totals
        invoice.amount_paid += payment_data.amount
        invoice.balance_due -= payment_data.amount
        
        # Automatic Status Logic
        if invoice.balance_due == Decimal("0"):
            invoice.status = InvoiceStatus.PAID.value
        else:
            invoice.status = InvoiceStatus.PARTIALLY_PAID.value
            
        db.commit()
        db.refresh(payment)
        return payment
