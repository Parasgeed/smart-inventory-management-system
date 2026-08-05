from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.purchase_return_model import PurchaseReturn, PurchaseReturnItem
from app.models.purchase_model import Purchase
from app.schemas.purchase_return_schema import PurchaseReturnCreate
from app.services.inventory_service import adjust_stock
from app.models.user_model import User

class PurchaseReturnService:
    @staticmethod
    def create_purchase_return(db: Session, return_data: PurchaseReturnCreate, current_user: User):
        # 1. Verify Purchase Order exists
        purchase = db.query(Purchase).filter(Purchase.id == return_data.purchase_id).first()
        if not purchase:
            raise HTTPException(status_code=404, detail="Purchase Order not found")

        # 2. Calculate Total Refund Amount
        total_refund = sum(item.refund_amount for item in return_data.items)

        # 3. Create Purchase Return record
        db_return = PurchaseReturn(
            purchase_id=return_data.purchase_id,
            total_refund_amount=total_refund,
            notes=return_data.notes,
            created_by=current_user.id
        )
        db.add(db_return)
        db.flush()

        # 4. Create Items and Deduct Inventory
        for item in return_data.items:
            db_item = PurchaseReturnItem(
                purchase_return_id=db_return.id,
                product_id=item.product_id,
                quantity=item.quantity,
                refund_amount=item.refund_amount,
                reason=item.reason
            )
            db.add(db_item)
            
            # Deduct inventory using RETURN_OUT
            adjust_stock(
                db=db,
                product_id=item.product_id,
                change_type="RETURN_OUT",
                quantity_changed=-item.quantity,  # Negative quantity because we are returning it to supplier
                reference_type="purchase_return",
                reference_id=db_return.id,
                performed_by=current_user.id
            )

        db.commit()
        db.refresh(db_return)
        return db_return
