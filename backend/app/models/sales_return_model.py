from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Numeric,
    Text
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database.database import Base


class SalesReturn(Base):
    __tablename__ = "sales_returns"

    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    return_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), default="PROCESSED")
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_refund_amount = Column(Numeric(10, 2), default=0.00)

    sales_order = relationship("SalesOrder", backref="returns")
    items = relationship("SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan")


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"

    id = Column(Integer, primary_key=True, index=True)
    sales_return_id = Column(Integer, ForeignKey("sales_returns.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    refund_amount = Column(Numeric(10, 2), default=0.00)
    reason = Column(String(255), nullable=True)

    sales_return = relationship("SalesReturn", back_populates="items")
    product = relationship("Product")
