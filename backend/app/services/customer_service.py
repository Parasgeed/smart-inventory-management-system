from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from fastapi import HTTPException
from app.models.customer_model import Customer
from app.models.sales_order_model import SalesOrder
from app.schemas.customer_schema import CustomerCreate, CustomerUpdate
from typing import Optional


class CustomerService:
    @staticmethod
    def _generate_customer_code(db: Session) -> str:
        count = db.query(Customer).count()
        return f"CUST-{(count + 1):04d}"

    @staticmethod
    def create_customer(db: Session, customer_in: CustomerCreate) -> Customer:
        customer_code = CustomerService._generate_customer_code(db)
        db_customer = Customer(
            **customer_in.model_dump(),
            customer_code=customer_code
        )
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer

    @staticmethod
    def get_customers(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None
    ):
        query = db.query(Customer)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Customer.name.ilike(search_term),
                    Customer.company_name.ilike(search_term),
                    Customer.email.ilike(search_term),
                    Customer.phone.ilike(search_term)
                )
            )
            
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        
        return total, items

    @staticmethod
    def get_customer_by_id(db: Session, customer_id: int) -> Customer:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer

    @staticmethod
    def update_customer(
        db: Session, customer_id: int, customer_in: CustomerUpdate
    ) -> Customer:
        db_customer = CustomerService.get_customer_by_id(db, customer_id)
        
        update_data = customer_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_customer, field, value)
            
        db.commit()
        db.refresh(db_customer)
        return db_customer

    @staticmethod
    def soft_delete_customer(db: Session, customer_id: int) -> Customer:
        db_customer = CustomerService.get_customer_by_id(db, customer_id)
        
        # Check if customer has any sales
        sales_count = db.query(SalesOrder).filter(SalesOrder.customer_id == customer_id).count()
        if sales_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete customer with associated sales."
            )
            
        db_customer.is_active = False
        db.commit()
        db.refresh(db_customer)
        return db_customer
