from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.schemas.sales_order_schema import (
    SalesOrderCreate,
    SalesOrderResponse,
    SalesOrderStatusUpdate,
    PackageCreate,
    PackageResponse,
    ShipmentCreate,
    ShipmentResponse
)
from app.services.sales_order_service import SalesOrderService
from app.auth.dependencies import get_current_user
from app.models.user_model import User


router = APIRouter(
    prefix="/sales-orders",
    tags=["Sales Orders"]
)

@router.post("/", response_model=SalesOrderResponse)
def create_sales_order(
    order_in: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new Sales Order in DRAFT status"""
    return SalesOrderService.create_sales_order(db=db, order_in=order_in, user_id=current_user.id)

@router.get("/", response_model=List[SalesOrderResponse])
def get_all_sales_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all sales orders"""
    return SalesOrderService.get_all_sales_orders(db=db, skip=skip, limit=limit)

@router.get("/{order_id}", response_model=SalesOrderResponse)
def get_sales_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific sales order"""
    return SalesOrderService.get_sales_order(db=db, order_id=order_id)

@router.patch("/{order_id}/status", response_model=SalesOrderResponse)
def update_sales_order_status(
    order_id: int,
    status_update: SalesOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update sales order status"""
    return SalesOrderService.update_status(db=db, order_id=order_id, status=status_update.status)

@router.post("/{order_id}/pack", response_model=PackageResponse)
def pack_sales_order(
    order_id: int,
    package_in: PackageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a package for a sales order"""
    return SalesOrderService.pack_order(db=db, order_id=order_id, package_in=package_in)

@router.post("/packages/{package_id}/ship", response_model=ShipmentResponse)
def ship_package(
    package_id: int,
    shipment_in: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ship a package (this deducts physical inventory)"""
    return SalesOrderService.ship_package(db=db, package_id=package_id, shipment_in=shipment_in, user_id=current_user.id)
