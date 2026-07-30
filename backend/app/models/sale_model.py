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


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    customer_name = Column(String(100))

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

    sale_items = relationship(
        "SaleItem",
        back_populates="sale",
        cascade="all, delete-orphan"
    )