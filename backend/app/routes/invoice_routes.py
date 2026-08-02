from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.invoice_model import Invoice
from app.schemas.invoice_schema import InvoiceResponse, InvoiceGenerateRequest
from app.services.invoice_service import InvoiceService
from app.services.payment_service import PaymentService
from app.schemas.payment_schema import PaymentCreate, PaymentResponse
from app.auth.dependencies import get_current_user
from app.auth.permissions import admin_required

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"]
)

@router.post("/", response_model=InvoiceResponse)
def create_invoice(
    request: InvoiceGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Only Admin and Manager (assuming staff isn't restricted from generate, let's keep it open to authenticated users per permissions)
    # The requirement says "Staff can Generate invoices", so any logged in user can generate.
    return InvoiceService.generate_invoice_from_so(db, request, current_user.id)


@router.get("/", response_model=List[InvoiceResponse])
def get_invoices(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Invoice).order_by(Invoice.id.desc()).all()


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return InvoiceService.get_invoice(db, invoice_id)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Simplified update for now, usually requires a schema
    admin_required(current_user)
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    admin_required(current_user) # Only Admin/Manager can delete
    invoice = InvoiceService.get_invoice(db, invoice_id)
    db.delete(invoice)
    db.commit()
    return {"message": "Invoice deleted"}


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
def send_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return InvoiceService.send_invoice(db, invoice_id)


@router.post("/{invoice_id}/record-payment", response_model=PaymentResponse)
def record_payment(
    invoice_id: int,
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return PaymentService.record_payment(db, invoice_id, payment_data)


@router.post("/{invoice_id}/void", response_model=InvoiceResponse)
def void_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    admin_required(current_user) # Only Admin/Manager can void
    return InvoiceService.void_invoice(db, invoice_id)


@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    invoice = InvoiceService.get_invoice(db, invoice_id)
    # Mock returning PDF
    return {"message": f"PDF generated for {invoice.invoice_number}"}
