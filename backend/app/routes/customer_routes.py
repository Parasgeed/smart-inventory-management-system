from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database.database import get_db
from app.schemas.customer_schema import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerPaginatedResponse
)
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_in: CustomerCreate,
    db: Session = Depends(get_db)
):
    return CustomerService.create_customer(db, customer_in)

@router.get("/", response_model=CustomerPaginatedResponse)
def get_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    total, items = CustomerService.get_customers(db, skip=skip, limit=limit, search=search)
    return {
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "size": limit,
        "items": items
    }

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db)
):
    return CustomerService.get_customer_by_id(db, customer_id)

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    db: Session = Depends(get_db)
):
    return CustomerService.update_customer(db, customer_id, customer_in)

@router.delete("/{customer_id}", response_model=CustomerResponse)
def soft_delete_customer(
    customer_id: int,
    db: Session = Depends(get_db)
):
    return CustomerService.soft_delete_customer(db, customer_id)
