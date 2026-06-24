from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db

from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.product_model import Product
from app.models.supplier_model import Supplier

from app.schemas.purchase_schema import (
    PurchaseCreate,
    PurchaseResponse
)

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

    supplier = db.query(Supplier).filter(
        Supplier.id == purchase_data.supplier_id
    ).first()

    if not supplier:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found"
        )

    purchase = Purchase(
        supplier_id=purchase_data.supplier_id,
        user_id=current_user.id,
        notes=purchase_data.notes,
        total_amount=0
    )

    db.add(purchase)
    db.flush()

    total_amount = 0

    for item in purchase_data.items:

        product = db.query(Product).filter(
            Product.id == item.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {item.product_id} not found"
            )

        subtotal = item.quantity * item.unit_price
        total_amount += subtotal

        purchase_item = PurchaseItem(
            purchase_id=purchase.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=subtotal
        )

        db.add(purchase_item)

        # Increase inventory
        product.quantity += item.quantity

    purchase.total_amount = total_amount

    db.commit()
    db.refresh(purchase)

    return purchase

@router.get("/", response_model=list[PurchaseResponse])
def get_purchases(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    return db.query(Purchase).all()

@router.get("/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    purchase = db.query(Purchase).filter(
        Purchase.id == purchase_id
    ).first()

    if not purchase:
        raise HTTPException(
            status_code=404,
            detail="Purchase not found"
        )

    return purchase

@router.get("/supplier/{supplier_id}",
            response_model=list[PurchaseResponse])
def get_supplier_purchases(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    return db.query(Purchase).filter(
        Purchase.supplier_id == supplier_id
    ).all()