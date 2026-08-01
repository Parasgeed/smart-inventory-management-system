from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    ForeignKey
)
from app.database.database import Base
from sqlalchemy.orm import relationship


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, index=True)

    sales_order_id = Column(
        Integer,
        ForeignKey("sales_orders.id"),
        nullable=False
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )

    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    cost_price_at_sale = Column(Numeric(10, 2), nullable=True)
    subtotal = Column(Numeric(10, 2), nullable=False)

    sales_order = relationship(
        "SalesOrder",
        back_populates="sales_order_items"
    )

    product = relationship(
        "Product",
        back_populates="sales_order_items"
    )
