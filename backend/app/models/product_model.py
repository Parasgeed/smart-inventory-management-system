from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey
)

from datetime import datetime, timezone

from app.database.database import Base
from sqlalchemy.orm import relationship


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)

    description = Column(String(500))

    sku = Column(String(100), unique=True, nullable=False)

    barcode = Column(String(100), unique=True)

    quantity = Column(Integer, default=0, nullable=False)

    cost_price = Column(Float, nullable=False)

    selling_price = Column(Float, nullable=False)

    reorder_level = Column(Integer, default=5, nullable=False)

    supplier_id = Column(
       Integer,
       ForeignKey("suppliers.id"),
    
      nullable=False
    )

    category_id = Column(
        Integer,
        ForeignKey("categories.id"),
        nullable=False
    )

    supplier = relationship(
       "Supplier",
       back_populates="products"
    )

    category = relationship(
       "Category",
        back_populates="products"
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    
