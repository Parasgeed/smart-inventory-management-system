from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    DateTime,
    ForeignKey
)

from sqlalchemy.orm import relationship

from datetime import datetime, timezone

from app.database.database import Base


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)

    supplier_id = Column(
        Integer,
        ForeignKey("suppliers.id"),
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    purchase_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    po_number = Column(String(100), unique=True, nullable=False)
    order_date = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    expected_delivery_date = Column(DateTime(timezone=True), nullable=True)

    tax_rate = Column(Numeric(5, 2), nullable=True, default=0.0)
    discount_rate = Column(Numeric(5, 2), nullable=True, default=0.0)
    shipping_charges = Column(Numeric(10, 2), nullable=True, default=0.0)

    payment_terms = Column(String(100), nullable=True)
    delivery_address = Column(String(255), nullable=True)

    status = Column(String(30), default="PENDING")

    total_amount = Column(Numeric(10, 2), nullable=False)

    notes = Column(String)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
     
    supplier = relationship(
       "Supplier",
       back_populates="purchases"
    )

    user = relationship(
       "User",
        back_populates="purchases"
    )

    purchase_items = relationship(
       "PurchaseItem",
        back_populates="purchase",
        cascade="all, delete-orphan"
    )