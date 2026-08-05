from sqlalchemy.orm import Session
from fastapi import HTTPException
from decimal import Decimal

from app.models.sales_return_model import SalesReturn, SalesReturnItem
from app.models.sales_order_model import SalesOrder
from app.schemas.sales_return_schema import SalesReturnCreate
from app.services.inventory_service import adjust_stock


class SalesReturnService:
    @staticmethod
    def create_sales_return(db: Session, return_data: SalesReturnCreate, current_user) -> SalesReturn:
        # Validate Sales Order exists
        sales_order = db.query(SalesOrder).filter(SalesOrder.id == return_data.sales_order_id).first()
        if not sales_order:
            raise HTTPException(status_code=404, detail="Sales Order not found")
        
        # Calculate total refund
        total_refund = sum(item.refund_amount for item in return_data.items)
        
        # Create Sales Return
        sales_return = SalesReturn(
            sales_order_id=sales_order.id,
            notes=return_data.notes,
            created_by=current_user.id,
            total_refund_amount=total_refund,
            status="PROCESSED"
        )
        db.add(sales_return)
        db.flush() # flush to get ID
        
        for item_data in return_data.items:
            # Create Return Item
            return_item = SalesReturnItem(
                sales_return_id=sales_return.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                refund_amount=item_data.refund_amount,
                reason=item_data.reason
            )
            db.add(return_item)
            
            # Restock inventory using RETURN_IN
            adjust_stock(
                db=db,
                product_id=item_data.product_id,
                change_type="RETURN_IN",
                quantity_changed=item_data.quantity,  # positive quantity because we are restocking
                reference_type="sales_return",
                reference_id=sales_return.id,
                performed_by=current_user.id
            )
            
        db.commit()
        db.refresh(sales_return)
        return sales_return
