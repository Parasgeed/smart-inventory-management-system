from sqlalchemy.orm import Session
from fastapi import HTTPException
from decimal import Decimal

from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.product_model import Product
from app.models.supplier_model import Supplier
from app.schemas.purchase_schema import (
    PurchaseCreate, PurchaseStatusUpdate, PurchaseStatus, PurchaseReceiveRequest
)
from app.services.inventory_service import (
    adjust_stock, ProductNotFoundError, InsufficientStockError
)
from app.services.notification_service import create_notification_for_all_users

class PurchaseService:
    @staticmethod
    def create_purchase(db: Session, purchase_data: PurchaseCreate, current_user_id: int) -> Purchase:
        supplier = db.query(Supplier).filter(Supplier.id == purchase_data.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

        purchase = Purchase(
            po_number=purchase_data.po_number,
            supplier_id=purchase_data.supplier_id,
            user_id=current_user_id,
            order_date=purchase_data.order_date,
            expected_delivery_date=purchase_data.expected_delivery_date,
            tax_rate=purchase_data.tax_rate or Decimal("0"),
            discount_rate=purchase_data.discount_rate or Decimal("0"),
            shipping_charges=purchase_data.shipping_charges or Decimal("0"),
            payment_terms=purchase_data.payment_terms,
            delivery_address=purchase_data.delivery_address,
            notes=purchase_data.notes,
            total_amount=Decimal("0"),
            status=PurchaseStatus.DRAFT.value
        )
        db.add(purchase)
        db.flush()

        subtotal_sum = Decimal("0")

        for item in purchase_data.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                db.rollback()
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            subtotal = Decimal(str(item.ordered_quantity)) * Decimal(str(item.unit_price))
            subtotal_sum += subtotal

            purchase_item = PurchaseItem(
                purchase_id=purchase.id,
                product_id=item.product_id,
                ordered_quantity=item.ordered_quantity,
                received_quantity=0,
                remaining_quantity=item.ordered_quantity,
                unit_price=item.unit_price,
                subtotal=subtotal
            )
            db.add(purchase_item)
            # Notice: We NO LONGER call adjust_stock here!

        discount_amount = subtotal_sum * (purchase.discount_rate / Decimal("100"))
        discounted_subtotal = subtotal_sum - discount_amount
        tax_amount = discounted_subtotal * (purchase.tax_rate / Decimal("100"))
        final_total = discounted_subtotal + tax_amount + purchase.shipping_charges
        
        purchase.total_amount = final_total
        db.commit()
        db.refresh(purchase)
        return purchase

    @staticmethod
    def update_purchase_status(db: Session, purchase_id: int, status_update: PurchaseStatusUpdate) -> Purchase:
        purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
        if not purchase:
            raise HTTPException(status_code=404, detail="Purchase not found")

        current_status = purchase.status
        new_status = status_update.status.value

        if current_status == new_status:
            return purchase

        VALID_TRANSITIONS = {
            PurchaseStatus.DRAFT.value: [PurchaseStatus.ISSUED.value, PurchaseStatus.CANCELLED.value],
            PurchaseStatus.ISSUED.value: [PurchaseStatus.CANCELLED.value],
            PurchaseStatus.PARTIALLY_RECEIVED.value: [PurchaseStatus.CANCELLED.value],
        }

        allowed = VALID_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition purchase from '{current_status}' to '{new_status}'."
            )

        purchase.status = new_status
        db.commit()
        db.refresh(purchase)
        return purchase

    @staticmethod
    def receive_items(db: Session, purchase_id: int, receive_data: PurchaseReceiveRequest, current_user_id: int) -> Purchase:
        purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
        if not purchase:
            raise HTTPException(status_code=404, detail="Purchase not found")

        if purchase.status in [PurchaseStatus.CANCELLED.value, PurchaseStatus.RECEIVED.value, PurchaseStatus.DRAFT.value]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive items for a purchase in '{purchase.status}' status."
            )

        # Dictionary for fast item lookup
        purchase_items_dict = {item.product_id: item for item in purchase.purchase_items}

        for req_item in receive_data.items:
            po_item = purchase_items_dict.get(req_item.product_id)
            if not po_item:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Product {req_item.product_id} is not part of this purchase order.")
            
            if req_item.quantity_received > po_item.remaining_quantity:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot receive {req_item.quantity_received} for product {req_item.product_id}. "
                           f"Only {po_item.remaining_quantity} remaining."
                )

            # Update item quantities
            po_item.received_quantity += req_item.quantity_received
            po_item.remaining_quantity -= req_item.quantity_received

            # Adjust physical stock
            try:
                adjust_stock(
                    db=db,
                    product_id=req_item.product_id,
                    quantity_changed=req_item.quantity_received,
                    change_type="PURCHASE_RECEIPT",
                    reference_type="purchase",
                    reference_id=purchase.id,
                    performed_by=current_user_id
                )
            except ProductNotFoundError as e:
                db.rollback()
                raise HTTPException(status_code=404, detail=str(e))
        
        # Check overall status
        all_received = all(item.remaining_quantity == 0 for item in purchase.purchase_items)
        if all_received:
            purchase.status = PurchaseStatus.RECEIVED.value
            create_notification_for_all_users(
                db=db,
                type="PURCHASE_RECEIVED",
                title="Purchase Order Received",
                message=f"Purchase order {purchase.po_number} from supplier has been fully received.",
                reference_id=purchase.id
            )
        else:
            purchase.status = PurchaseStatus.PARTIALLY_RECEIVED.value

        db.commit()
        db.refresh(purchase)
        return purchase
