from sqlalchemy import Column, Integer, String, DateTime 
from datetime import datetime, timezone
from app.database.database import Base

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(
        Integer,
        primary_key=True, 
        index=True
    )
    
    name = Column(
        String, 
        unique=True, 
        index=True, 
        nullable=False
    )

    description = Column(
        String, 
        nullable=True
    ) 
    
    created_at = Column(
        DateTime, 
        default=lambda: datetime.now(timezone.utc)
    )
    
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )