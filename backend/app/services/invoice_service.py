from sqlalchemy.orm import Session
from fastapi import HTTPException
from decimal import Decimal
from datetime import datetime, timezone

from app.models.invoice_model import Invoice, InvoiceItem
from app.models.sales_order_model import SalesOrder
from app.schemas.invoice_schema import InvoiceStatus, InvoiceGenerateRequest
from app.schemas.sales_order_schema import SalesOrderStatus


class InvoiceService:
    @staticmethod
    def _generate_invoice_number(db: Session) -> str:
        # Get the latest invoice ID to generate next number
        latest_invoice = db.query(Invoice).order_by(Invoice.id.desc()).first()
        next_id = (latest_invoice.id + 1) if latest_invoice else 1
        return f"INV-{next_id:06d}"

    @staticmethod
    def generate_invoice_from_so(db: Session, request: InvoiceGenerateRequest, current_user_id: int) -> Invoice:
        # Fetch Sales Order
        so = db.query(SalesOrder).filter(SalesOrder.id == request.sales_order_id).first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales Order not found")

        # Business Rule: Invoice can ONLY be generated from a SHIPPED (or COMPLETED) Sales Order.
        if so.status not in [SalesOrderStatus.SHIPPED.value, SalesOrderStatus.COMPLETED.value]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot generate invoice for Sales Order in '{so.status}' status. Must be SHIPPED."
            )

        # Business Rule: Cannot generate two active invoices for the same Sales Order.
        existing_invoice = db.query(Invoice).filter(Invoice.sales_order_id == so.id).first()
        if existing_invoice and existing_invoice.status != InvoiceStatus.VOID.value:
            raise HTTPException(status_code=400, detail="An active invoice already exists for this Sales Order")

        invoice_number = InvoiceService._generate_invoice_number(db)
        
        # Calculate totals from SO items
        subtotal = sum((item.subtotal for item in so.sales_order_items), Decimal("0"))
        # We assume 0 tax/discount/shipping for now as they aren't explicitly on SO items in this version
        total_amount = subtotal

        invoice = Invoice(
            invoice_number=invoice_number,
            sales_order_id=so.id,
            customer_id=so.customer_id,
            subtotal=subtotal,
            tax_amount=Decimal("0"),
            discount_amount=Decimal("0"),
            shipping_charge=Decimal("0"),
            total_amount=total_amount,
            amount_paid=Decimal("0"),
            balance_due=total_amount,
            notes=request.notes,
            terms_and_conditions=request.terms_and_conditions,
            status=InvoiceStatus.DRAFT.value,
            created_by=current_user_id
        )
        db.add(invoice)
        db.flush()

        for item in so.sales_order_items:
            inv_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount=Decimal("0"),
                tax=Decimal("0"),
                subtotal=item.subtotal
            )
            db.add(inv_item)

        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def send_invoice(db: Session, invoice_id: int) -> Invoice:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.status != InvoiceStatus.DRAFT.value:
            raise HTTPException(status_code=400, detail="Only DRAFT invoices can be sent")
            
        invoice.status = InvoiceStatus.SENT.value
        # Mocking email send
        print(f"Sending email for invoice {invoice.invoice_number}...")
        
        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def void_invoice(db: Session, invoice_id: int) -> Invoice:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
            
        if invoice.status == InvoiceStatus.PAID.value:
            raise HTTPException(status_code=400, detail="Cannot void a PAID invoice")
            
        invoice.status = InvoiceStatus.VOID.value
        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def get_invoice(db: Session, invoice_id: int) -> Invoice:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice
