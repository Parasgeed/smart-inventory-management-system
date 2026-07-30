from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from app.database.database import get_db

from app.models.sale_model import Sale
from app.models.sale_item_model import SaleItem
from app.models.product_model import Product

from app.schemas.sale_schema import (
    SaleCreate,
    SaleResponse
)

from app.services.inventory_service import (
    adjust_stock,
    InsufficientStockError,
    ProductNotFoundError
)

from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/sales",
    tags=["Sales"]
)


@router.post("/", response_model=SaleResponse)
def create_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    sale = Sale(
        user_id=current_user.id,
        customer_name=sale_data.customer_name,
        payment_method=sale_data.payment_method,
        total_amount=Decimal("0")
    )

    db.add(sale)
    db.flush()  # assigns sale.id without committing, so we can reference it below

    total_amount = Decimal("0")

    try:
        for item in sale_data.items:

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

            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=subtotal,
                # Snapshot cost at time of sale so profit-loss reports stay
                # accurate even if the supplier's price changes later.
                cost_price_at_sale=product.cost_price
            )
            db.add(sale_item)

            # Stock decrease + audit log, both handled centrally.
            # Negative quantity_changed is what makes this a decrease —
            # adjust_stock() itself doesn't know "sale" means "subtract",
            # it just does previous_quantity + quantity_changed.
            adjust_stock(
                db=db,
                product_id=item.product_id,
                quantity_changed=-item.quantity,
                change_type="SALE",
                reference_type="sale",
                reference_id=sale.id,
                performed_by=current_user.id
            )

        sale.total_amount = total_amount
        db.commit()
        db.refresh(sale)
        return sale

    except ProductNotFoundError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))

    except InsufficientStockError as e:
        # This is the real case, unlike in create_purchase — selling more
        # than what's in stock rolls back the entire sale, not just this line item.
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[SaleResponse])
def get_sales(
    limit: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Sale).order_by(Sale.sale_date.desc())

    if limit is not None:
        query = query.limit(limit)

    return query.all()


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    sale = db.query(Sale).filter(
        Sale.id == sale_id
    ).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    return sale