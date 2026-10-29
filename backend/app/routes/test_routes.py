from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel

from app.database.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.permissions import admin_required
from app.models.user_model import User

router = APIRouter(
    prefix="/test-cleanup",
    tags=["Testing & Maintenance"]
)

class CleanupRequest(BaseModel):
    product_id: Optional[int] = None
    supplier_id: Optional[int] = None
    category_id: Optional[int] = None
    unique_id: Optional[str] = None

@router.post("/teardown")
def teardown_test_entities(
    req: CleanupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin-only teardown endpoint for cleaning up E2E test artifacts."""
    admin_required(current_user)

    deleted_summary = {}

    try:
        # 1. Clean up product & related orders/shipments/invoices
        if req.product_id:
            # Find affected sales orders
            so_rows = db.execute(text(
                "SELECT DISTINCT sales_order_id FROM sales_order_items WHERE product_id = :pid"
            ), {"pid": req.product_id}).fetchall()
            so_ids = [r[0] for r in so_rows]

            if so_ids:
                # Find packages
                pkg_rows = db.execute(text(
                    "SELECT id FROM packages WHERE sales_order_id = ANY(:so_ids)"
                ), {"so_ids": so_ids}).fetchall()
                pkg_ids = [p[0] for p in pkg_rows]

                if pkg_ids:
                    db.execute(text("DELETE FROM shipments WHERE package_id = ANY(:pkg_ids)"), {"pkg_ids": pkg_ids})
                    db.execute(text("DELETE FROM packages WHERE id = ANY(:pkg_ids)"), {"pkg_ids": pkg_ids})

                # Invoices
                inv_rows = db.execute(text(
                    "SELECT id FROM invoices WHERE sales_order_id = ANY(:so_ids)"
                ), {"so_ids": so_ids}).fetchall()
                inv_ids = [i[0] for i in inv_rows]

                if inv_ids:
                    db.execute(text("DELETE FROM payments WHERE invoice_id = ANY(:inv_ids)"), {"inv_ids": inv_ids})
                    db.execute(text("DELETE FROM invoice_items WHERE invoice_id = ANY(:inv_ids)"), {"inv_ids": inv_ids})
                    db.execute(text("DELETE FROM invoices WHERE id = ANY(:inv_ids)"), {"inv_ids": inv_ids})

                db.execute(text("DELETE FROM sales_order_items WHERE sales_order_id = ANY(:so_ids)"), {"so_ids": so_ids})
                db.execute(text("DELETE FROM sales_orders WHERE id = ANY(:so_ids)"), {"so_ids": so_ids})

            # Logs & notifications
            db.execute(text("DELETE FROM inventory_logs WHERE product_id = :pid"), {"pid": req.product_id})
            db.execute(text("DELETE FROM notifications WHERE reference_id = :pid"), {"pid": req.product_id})
            db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": req.product_id})
            deleted_summary["product_id"] = req.product_id

        # 2. Clean up supplier
        if req.supplier_id:
            db.execute(text("DELETE FROM suppliers WHERE id = :sid"), {"sid": req.supplier_id})
            deleted_summary["supplier_id"] = req.supplier_id

        # 3. Clean up category
        if req.category_id:
            db.execute(text("DELETE FROM categories WHERE id = :cid"), {"cid": req.category_id})
            deleted_summary["category_id"] = req.category_id

        # 4. Clean up notifications referencing unique_id if provided
        if req.unique_id:
            db.execute(text(
                "DELETE FROM notifications WHERE message LIKE :pattern OR title LIKE :pattern"
            ), {"pattern": f"%{req.unique_id}%"})

        db.commit()
        return {"status": "success", "deleted": deleted_summary}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
