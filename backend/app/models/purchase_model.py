from sqlalchemy import (
    Column,
    Integer,
    Float,
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

    status = Column(String(30), default="PENDING")

    total_amount = Column(Float, nullable=False)

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