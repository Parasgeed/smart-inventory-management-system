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


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)

    package_id = Column(
        Integer,
        ForeignKey("packages.id"),
        nullable=False
    )
    
    tracking_number = Column(String(100), nullable=False)
    courier = Column(String(100), nullable=False)

    shipped_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    package = relationship(
        "Package",
        back_populates="shipments"
    )
