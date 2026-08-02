from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    ForeignKey,
    Text,
)
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
from app.database.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    
    payment_reference = Column(String(100), nullable=True)
    payment_method = Column(String(50), nullable=False)
    payment_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    amount = Column(Numeric(10, 2), nullable=False)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    invoice = relationship("Invoice", back_populates="payments")
