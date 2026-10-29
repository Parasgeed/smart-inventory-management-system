from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.purchase_model import Purchase
from app.schemas.purchase_schema import (
    PurchaseCreate,
    PurchaseResponse,
    PurchaseStatusUpdate,
    PurchaseReceiveRequest
)
from app.services.purchase_service import PurchaseService
from app.auth.dependencies import get_current_user
from app.auth.permissions import admin_required

router = APIRouter(
    prefix="/purchases",
    tags=["Purchases"]
)

@router.post("/", response_model=PurchaseResponse)
def create_purchase(
    purchase_data: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    admin_required(current_user)
    return PurchaseService.create_purchase(db, purchase_data, current_user.id)

@router.get("/", response_model=list[PurchaseResponse])
def get_purchases(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Purchase).all()

@router.get("/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(
    purchase_id: int = Path(..., ge=1, description="Purchase ID must be a positive integer"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return purchase

@router.get("/supplier/{supplier_id}", response_model=list[PurchaseResponse])
def get_supplier_purchases(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Purchase).filter(Purchase.supplier_id == supplier_id).all()

@router.patch("/{purchase_id}/status", response_model=PurchaseResponse)
def update_purchase_status(
    purchase_id: int,
    status_update: PurchaseStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    admin_required(current_user)
    return PurchaseService.update_purchase_status(db, purchase_id, status_update)

@router.post("/{purchase_id}/receive", response_model=PurchaseResponse)
def receive_purchase_items(
    purchase_id: int,
    receive_data: PurchaseReceiveRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    admin_required(current_user)
    return PurchaseService.receive_items(db, purchase_id, receive_data, current_user.id)