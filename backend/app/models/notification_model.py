from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime, timezone
from app.database.database import Base
from sqlalchemy.orm import relationship

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    type = Column(String(50), nullable=False)  # e.g. LOW_STOCK, PURCHASE_RECEIVED
    title = Column(String(255), nullable=False)
    message = Column(String(1000), nullable=False)
    is_read = Column(Boolean, default=False, index=True)
    reference_id = Column(Integer, nullable=True) # ID of the related entity
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="notifications")
