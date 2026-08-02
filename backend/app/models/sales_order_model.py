from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    DateTime,
    ForeignKey
)
from datetime import datetime, timezone
from app.database.database import Base
from sqlalchemy.orm import relationship


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )
    
    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=True
    )

    status = Column(String(30), default="DRAFT", nullable=False)
    payment_method = Column(String(50))

    sale_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    total_amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    user = relationship(
        "User",
        back_populates="sales"
    )
    
    customer = relationship(
        "Customer",
        back_populates="sales"
    )

    sales_order_items = relationship(
        "SalesOrderItem",
        back_populates="sales_order",
        cascade="all, delete-orphan"
    )

    packages = relationship(
        "Package",
        back_populates="sales_order",
        cascade="all, delete-orphan"
    )

    invoice = relationship(
        "Invoice",
        back_populates="sales_order",
        uselist=False,
        cascade="all, delete-orphan"
    )
