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

class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(
        Integer,
        ForeignKey("purchases.id"),
        nullable=False
    )
    return_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    status = Column(String(30), default="COMPLETED")
    total_refund_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    notes = Column(String, nullable=True)
    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    purchase = relationship("Purchase")
    user = relationship("User")
    return_items = relationship(
        "PurchaseReturnItem",
        back_populates="purchase_return",
        cascade="all, delete-orphan"
    )

class PurchaseReturnItem(Base):
    __tablename__ = "purchase_return_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_return_id = Column(
        Integer,
        ForeignKey("purchase_returns.id"),
        nullable=False
    )
    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )
    quantity = Column(Integer, nullable=False)
    refund_amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(String(255), nullable=True)

    purchase_return = relationship(
        "PurchaseReturn",
        back_populates="return_items"
    )
    product = relationship("Product")
