from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.payment_model import Payment
from app.schemas.payment_schema import PaymentResponse
from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)


@router.get("/", response_model=List[PaymentResponse])
def get_payments(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Payment).order_by(Payment.payment_date.desc()).all()


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment
