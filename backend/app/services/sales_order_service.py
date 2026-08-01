from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.package_model import Package
from app.models.shipment_model import Shipment
from app.models.product_model import Product
from app.schemas.sales_order_schema import (
    SalesOrderCreate,
    SalesOrderStatus,
    PackageStatus,
    PackageCreate,
    ShipmentCreate
)
from app.services.inventory_service import adjust_stock


class SalesOrderService:
    @staticmethod
    def create_sales_order(db: Session, order_in: SalesOrderCreate, user_id: int) -> SalesOrder:
        total_amount = sum(item.quantity * item.unit_price for item in order_in.items)

        db_order = SalesOrder(
            user_id=user_id,
            customer_id=order_in.customer_id,
            payment_method=order_in.payment_method,
            total_amount=total_amount,
            status=SalesOrderStatus.DRAFT.value
        )
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

        for item_in in order_in.items:
            product = db.query(Product).filter(Product.id == item_in.product_id).first()
            if not product:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Product with ID {item_in.product_id} not found.")

            subtotal = item_in.quantity * item_in.unit_price
            
            db_item = SalesOrderItem(
                sales_order_id=db_order.id,
                product_id=item_in.product_id,
                quantity=item_in.quantity,
                unit_price=item_in.unit_price,
                subtotal=subtotal,
                cost_price_at_sale=product.cost_price
            )
            db.add(db_item)
        
        db.commit()
        db.refresh(db_order)
        return db_order

    @staticmethod
    def get_sales_order(db: Session, order_id: int) -> SalesOrder:
        order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Sales Order not found")
        return order

    @staticmethod
    def get_all_sales_orders(db: Session, skip: int = 0, limit: int = 100):
        return db.query(SalesOrder).order_by(SalesOrder.id.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_status(db: Session, order_id: int, status: SalesOrderStatus) -> SalesOrder:
        order = SalesOrderService.get_sales_order(db, order_id)
        
        # Simple status validation (in a real system, you'd have a strict FSM here)
        if order.status == SalesOrderStatus.SHIPPED.value and status != SalesOrderStatus.DELIVERED.value and status != SalesOrderStatus.COMPLETED.value:
             raise HTTPException(status_code=400, detail="Cannot change status back from SHIPPED without a return process.")
             
        order.status = status.value
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def pack_order(db: Session, order_id: int, package_in: PackageCreate) -> Package:
        order = SalesOrderService.get_sales_order(db, order_id)
        if order.status not in [SalesOrderStatus.DRAFT.value, SalesOrderStatus.CONFIRMED.value]:
            raise HTTPException(status_code=400, detail="Can only pack orders that are DRAFT or CONFIRMED.")
            
        try:
            package = Package(
                sales_order_id=order_id,
                package_number=package_in.package_number,
                status=PackageStatus.PACKED.value
            )
            db.add(package)
            
            # Update order status
            order.status = SalesOrderStatus.PACKED.value
            
            db.commit()
            db.refresh(package)
            return package
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Package number already exists.")

    @staticmethod
    def ship_package(db: Session, package_id: int, shipment_in: ShipmentCreate, user_id: int) -> Shipment:
        package = db.query(Package).filter(Package.id == package_id).first()
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
            
        if package.status == PackageStatus.SHIPPED.value:
            raise HTTPException(status_code=400, detail="Package is already shipped.")
            
        order = package.sales_order

        # 1. Deduct Stock via InventoryService (The crucial business logic change!)
        for item in order.sales_order_items:
            # We pass negative quantity to adjust_stock to deduct it!
            adjust_stock(
                db=db,
                product_id=item.product_id,
                quantity_changed=-item.quantity,
                change_type="SALE",
                reference_type="SALES_ORDER",
                reference_id=order.id,
                performed_by=user_id
            )

        # 2. Create Shipment
        shipment = Shipment(
            package_id=package.id,
            tracking_number=shipment_in.tracking_number,
            courier=shipment_in.courier
        )
        db.add(shipment)
        
        # 3. Update Package and Order statuses
        package.status = PackageStatus.SHIPPED.value
        order.status = SalesOrderStatus.SHIPPED.value

        db.commit()
        db.refresh(shipment)
        return shipment
