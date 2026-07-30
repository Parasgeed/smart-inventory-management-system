from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    ForeignKey
)

from app.database.database import Base
from sqlalchemy.orm import relationship


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)

    sale_id = Column(
        Integer,
        ForeignKey("sales.id"),
        nullable=False
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )

    quantity = Column(Integer, nullable=False)

    unit_price = Column(Numeric(10, 2), nullable=False)

    cost_price_at_sale = Column(
    Numeric(10, 2),
    nullable=True
    )

    subtotal = Column(Numeric(10, 2), nullable=False)

    sale = relationship(
        "Sale",
        back_populates="sale_items"
    )

    product = relationship(
        "Product",
        back_populates="sale_items"
    )
