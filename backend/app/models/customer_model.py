from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime, timezone
from sqlalchemy.orm import relationship

from app.database.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), index=True)
    company_name = Column(String(150), index=True, nullable=True)
    email = Column(String(100), index=True, nullable=True)
    phone = Column(String(20), index=True, nullable=True)
    gst_number = Column(String(50), nullable=True)
    
    billing_address = Column(String(255), nullable=True)
    shipping_address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    sales = relationship(
        "SalesOrder",
        back_populates="customer"
    )

    invoices = relationship(
        "Invoice",
        back_populates="customer"
    )
