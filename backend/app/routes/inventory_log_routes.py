from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db

from app.models.inventory_log_model import InventoryLog
from app.models.product_model import Product

from app.schemas.inventory_log_schema import InventoryLogResponse

from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/inventory-logs",
    tags=["Inventory Logs"]
)

# Read-only by design — this table is written exclusively by
# adjust_stock() in app/services/inventory_service.py. No POST/PUT/DELETE here.


@router.get("/", response_model=list[InventoryLogResponse])
def get_inventory_logs(
    limit: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(InventoryLog).order_by(InventoryLog.timestamp.desc())

    if limit is not None:
        query = query.limit(limit)

    return query.all()


@router.get("/product/{product_id}", response_model=list[InventoryLogResponse])
def get_product_inventory_logs(
    product_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Oldest first here (vs. newest-first on the full trail) — this endpoint
    # tells the story of one product's stock over time, so it reads chronologically.
    logs = db.query(InventoryLog).filter(
        InventoryLog.product_id == product_id
    ).order_by(InventoryLog.timestamp.asc()).all()

    return logs