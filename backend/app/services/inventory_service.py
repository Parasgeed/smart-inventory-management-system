from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models.product_model import Product
from app.models.inventory_log_model import InventoryLog
from app.services.notification_service import create_notification_for_all_users


class InsufficientStockError(Exception):
    """
    Raised when a stock decrease would take a product's quantity below zero.
    Deliberately a plain Python exception, not an HTTPException — this service
    has no dependency on FastAPI, so it can be reused by anything (routes,
    background jobs, scripts, tests) without dragging in the web framework.
    """
    def __init__(self, product_id: int, available: int, requested: int):
        self.product_id = product_id
        self.available = available
        self.requested = requested
        super().__init__(
            f"Insufficient stock for product {product_id}: "
            f"requested {requested}, available {available}"
        )


class ProductNotFoundError(Exception):
    def __init__(self, product_id: int):
        self.product_id = product_id
        super().__init__(f"Product {product_id} not found")


def adjust_stock(
    db: Session,
    product_id: int,
    quantity_changed: int,
    change_type: str,
    reference_type: str,
    reference_id: int,
    performed_by: int | None = None,
) -> Product:
    """
    The single, centralized entry point for every stock mutation in the system.

    quantity_changed is signed:
        positive -> stock increase  (e.g. a purchase arriving)
        negative -> stock decrease  (e.g. a sale going out)

    change_type    : "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN" (business reason)
    reference_type : "purchase" | "sale" | "manual"                (source table)
    reference_id   : the id of the row in that source table
    performed_by   : user.id of whoever triggered this movement (nullable for
                     legacy rows and non-request contexts like scripts/jobs)

    Does NOT commit. The caller owns the transaction boundary, because a
    single business operation (e.g. one purchase with several line items)
    must apply all of its stock adjustments atomically — either all of them
    land, or none do.
    """

    # Row-level lock: SELECT ... FOR UPDATE. If two requests try to adjust
    # the same product's stock at the same moment (e.g. two concurrent sales
    # of the last unit), the second request blocks here until the first
    # transaction commits or rolls back. Without this lock, both requests
    # could read the same starting quantity and both "succeed," resulting
    # in stock going negative — a classic race condition in inventory systems.
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .with_for_update()
        .first()
    )

    if not product:
        raise ProductNotFoundError(product_id)

    previous_quantity = product.quantity
    new_quantity = previous_quantity + quantity_changed

    if new_quantity < 0:
        raise InsufficientStockError(
            product_id=product_id,
            available=previous_quantity,
            requested=abs(quantity_changed),
        )

    product.quantity = new_quantity

    # Notifications
    if new_quantity == 0 and previous_quantity > 0:
        create_notification_for_all_users(
            db=db,
            type="OUT_OF_STOCK",
            title="Product Out of Stock",
            message=f"Product '{product.name}' (SKU: {product.sku}) is completely out of stock.",
            reference_id=product.id
        )
    reorder_lvl = getattr(product, "reorder_level", None)
    if isinstance(reorder_lvl, (int, float)) and new_quantity <= reorder_lvl and previous_quantity > reorder_lvl:
        create_notification_for_all_users(
            db=db,
            type="LOW_STOCK",
            title="Low Stock Alert",
            message=f"Product '{product.name}' (SKU: {product.sku}) has reached its reorder level. Current quantity: {new_quantity}.",
            reference_id=product.id
        )

    log_entry = InventoryLog(
        product_id=product_id,
        performed_by=performed_by,
        change_type=change_type,
        reference_type=reference_type,
        reference_id=reference_id,
        quantity_changed=quantity_changed,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log_entry)

    return product