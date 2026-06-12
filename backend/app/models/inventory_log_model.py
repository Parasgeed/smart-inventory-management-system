from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey
)

from datetime import datetime, timezone

from app.database.database import Base


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )

    change_type = Column(String(50), nullable=False)

    reference_type = Column(String(50))

    reference_id = Column(Integer)

    quantity_changed = Column(Integer, nullable=False)

    previous_quantity = Column(Integer, nullable=False)

    new_quantity = Column(Integer, nullable=False)

    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )