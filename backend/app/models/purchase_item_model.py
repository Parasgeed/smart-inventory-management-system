from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    ForeignKey
)

from app.database.database import Base

from sqlalchemy.orm import relationship


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)

    purchase_id = Column(
        Integer,
        ForeignKey("purchases.id"),
        nullable=False
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )

    quantity = Column(Integer, nullable=False)

    unit_price = Column(Numeric(10, 2), nullable=False)

    subtotal = Column(Numeric(10, 2), nullable=False)

    purchase = relationship(
       "Purchase",
        back_populates="purchase_items"
    )

    product = relationship(
       "Product",
       back_populates="purchase_items"
    )