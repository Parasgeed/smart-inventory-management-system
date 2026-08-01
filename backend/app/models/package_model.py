from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey
)
from datetime import datetime, timezone
from app.database.database import Base
from sqlalchemy.orm import relationship


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)

    sales_order_id = Column(
        Integer,
        ForeignKey("sales_orders.id"),
        nullable=False
    )
    
    package_number = Column(String(50), nullable=False, unique=True)
    status = Column(String(30), default="PACKED", nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    sales_order = relationship(
        "SalesOrder",
        back_populates="packages"
    )

    shipments = relationship(
        "Shipment",
        back_populates="package",
        cascade="all, delete-orphan"
    )
