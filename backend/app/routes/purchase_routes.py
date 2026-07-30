from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from app.database.database import get_db

from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.product_model import Product
from app.models.supplier_model import Supplier

from app.schemas.purchase_schema import (
    PurchaseCreate,
    PurchaseResponse,
    PurchaseStatusUpdate
)

from app.services.inventory_service import (
    adjust_stock,
    InsufficientStockError,
    ProductNotFoundError
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
        po_number=purchase_data.po_number,
        supplier_id=purchase_data.supplier_id,
        user_id=current_user.id,
        order_date=purchase_data.order_date,
        expected_delivery_date=purchase_data.expected_delivery_date,
        tax_rate=purchase_data.tax_rate or Decimal("0"),
        discount_rate=purchase_data.discount_rate or Decimal("0"),
        shipping_charges=purchase_data.shipping_charges or Decimal("0"),
        payment_terms=purchase_data.payment_terms,
        delivery_address=purchase_data.delivery_address,
        notes=purchase_data.notes,
        total_amount=Decimal("0")
    )

    db.add(purchase)
    db.flush()  # assigns purchase.id without committing, so we can reference it below

    subtotal_sum = Decimal("0")

    try:
        for item in purchase_data.items:

            product = db.query(Product).filter(
                Product.id == item.product_id
            ).first()

            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"Product {item.product_id} not found"
                )

            subtotal = Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            subtotal_sum += subtotal

            purchase_item = PurchaseItem(
                purchase_id=purchase.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=subtotal
            )
            db.add(purchase_item)

            adjust_stock(
                db=db,
                product_id=item.product_id,
                quantity_changed=item.quantity,
                change_type="PURCHASE",
                reference_type="purchase",
                reference_id=purchase.id,
                performed_by=current_user.id
            )

        # Calculate final total
        discount_amount = subtotal_sum * (purchase.discount_rate / Decimal("100"))
        discounted_subtotal = subtotal_sum - discount_amount
        tax_amount = discounted_subtotal * (purchase.tax_rate / Decimal("100"))
        
        final_total = discounted_subtotal + tax_amount + purchase.shipping_charges
        
        purchase.total_amount = final_total
        db.commit()
        db.refresh(purchase)
        return purchase

    except ProductNotFoundError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))

    except InsufficientStockError as e:
        # Won't actually trigger on purchases (quantity_changed is always
        # positive here), but handled for consistency since Sales will
        # reuse this exact same try/except pattern.
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[PurchaseResponse])
def get_purchases(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)):
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
        raise HTTPException(status_code=404, detail="Purchase not found")

    return purchase


@router.get("/supplier/{supplier_id}", response_model=list[PurchaseResponse])
def get_supplier_purchases(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)):
        return db.query(Purchase).filter(
            Purchase.supplier_id == supplier_id).all()


@router.patch("/{purchase_id}/status", response_model=PurchaseResponse)
def update_purchase_status(
    purchase_id: int,
    status_update: PurchaseStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    admin_required(current_user)

    purchase = db.query(Purchase).filter(
        Purchase.id == purchase_id
    ).first()

    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    current_status = purchase.status
    new_status = status_update.status.value

    # Guard: no-op if already in the requested state
    if current_status == new_status:
        return purchase

    # Valid transition table:
    #   PENDING   → RECEIVED   (mark goods as arrived, stock already increased at creation)
    #   PENDING   → CANCELLED  (reverse the stock increase)
    #   All other transitions are rejected — no going back from RECEIVED or CANCELLED
    VALID_TRANSITIONS = {
        "PENDING": ["RECEIVED", "CANCELLED"],
    }

    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition purchase from '{current_status}' to '{new_status}'. "
                   f"Allowed transitions from '{current_status}': {allowed or 'none'}"
        )

    # CANCELLED: reverse every stock increase this purchase caused
    if new_status == "CANCELLED":
        try:
            for item in purchase.purchase_items:
                adjust_stock(
                    db=db,
                    product_id=item.product_id,
                    quantity_changed=-item.quantity,  # negative = reversing the increase
                    change_type="PURCHASE_CANCELLED",
                    reference_type="purchase",
                    reference_id=purchase.id,
                    performed_by=current_user.id
                )
        except InsufficientStockError as e:
            # Edge case: stock was sold after the purchase arrived, so reversing
            # would push quantity negative. Surface this clearly rather than
            # silently failing or corrupting inventory.
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel purchase: {str(e)}. "
                       f"Some stock from this purchase has already been sold."
            )
        except ProductNotFoundError as e:
            db.rollback()
            raise HTTPException(status_code=404, detail=str(e))

    purchase.status = new_status
    db.commit()
    db.refresh(purchase)
    return purchase