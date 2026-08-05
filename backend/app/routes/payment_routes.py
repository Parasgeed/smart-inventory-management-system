import os
import razorpay
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.database.database import get_db
from app.models.payment_model import Payment
from app.schemas.payment_schema import (
    PaymentResponse,
    RazorpayOrderRequest,
    RazorpayVerifyRequest,
    PaymentCreate,
    PaymentMethod
)
from app.auth.dependencies import get_current_user
from app.services.payment_service import PaymentService

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

# Initialize Razorpay Client (safe to init here if env is loaded)
razorpay_client = razorpay.Client(
    auth=(os.getenv("RAZORPAY_KEY_ID", ""), os.getenv("RAZORPAY_KEY_SECRET", ""))
)

@router.post("/razorpay/create-order")
def create_razorpay_order(
    request: RazorpayOrderRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        # Razorpay expects amount in paise
        amount_in_paise = int(request.amount * 100)
        
        order_data = {
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"inv_{request.invoice_id}",
            "payment_capture": 1
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": os.getenv("RAZORPAY_KEY_ID")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/razorpay/verify")
def verify_razorpay_payment(
    request: RazorpayVerifyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        # Verify Signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        })
        
        # Fetch payment details from Razorpay to get the exact captured amount
        payment_details = razorpay_client.payment.fetch(request.razorpay_payment_id)
        amount_paid = Decimal(str(payment_details["amount"])) / Decimal("100")
        
        # We can map the actual payment method from Razorpay (e.g. upi, card, netbanking)
        # to our internal enum. For now, we use a generic mapping or BANK_TRANSFER if it doesn't match perfectly.
        rzp_method = payment_details.get("method", "").lower()
        method_map = {
            "upi": PaymentMethod.UPI,
            "card": PaymentMethod.CREDIT_CARD,
            "netbanking": PaymentMethod.BANK_TRANSFER,
            "wallet": PaymentMethod.WALLET
        }
        internal_method = method_map.get(rzp_method, PaymentMethod.BANK_TRANSFER)
        
        payment_data = PaymentCreate(
            payment_method=internal_method,
            amount=amount_paid,
            payment_reference=request.razorpay_payment_id,
            notes=f"Razorpay Order: {request.razorpay_order_id}"
        )
        
        PaymentService.record_payment(db, request.invoice_id, payment_data)
        
        return {"status": "success", "message": "Payment verified and recorded successfully"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
