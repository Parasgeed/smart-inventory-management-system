from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.database.database import get_db

from app.models.product_model import Product
from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.supplier_model import Supplier
from app.models.category_model import Category

from app.schemas.dashboard_schema import (
    DashboardSummaryResponse,
    DashboardActivityItem,
    TopSellingProductItem,
    TopPurchasedProductItem,
    MonthlyTrendItem,
    CategoryDistributionItem,
    InventoryValueResponse,
    DeadStockItem
)
from app.schemas.product_schema import ProductResponse

from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


def _inventory_value(db: Session) -> Decimal:
    return db.query(
        func.sum(Product.quantity * Product.cost_price)
    ).scalar() or Decimal("0")


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    today_sales_total = db.query(
        func.sum(SalesOrder.total_amount)
    ).filter(
        SalesOrder.sale_date >= today_start
    ).scalar() or Decimal("0")

    return DashboardSummaryResponse(
        total_products=db.query(Product).count(),
        total_suppliers=db.query(Supplier).count(),
        total_categories=db.query(Category).count(),
        low_stock_count=db.query(Product).filter(
            Product.quantity <= Product.reorder_level
        ).count(),
        total_inventory_value=_inventory_value(db),
        today_sales_total=today_sales_total,
        today_sales_count=db.query(SalesOrder).filter(
            SalesOrder.sale_date >= today_start
        ).count()
    )


@router.get("/activity", response_model=list[DashboardActivityItem])
def get_dashboard_activity(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    recent_purchases = (
        db.query(Purchase)
        .order_by(Purchase.purchase_date.desc())
        .limit(limit)
        .all()
    )

    recent_sales = (
        db.query(SalesOrder)
        .order_by(SalesOrder.sale_date.desc())
        .limit(limit)
        .all()
    )

    activity: list[DashboardActivityItem] = []

    for p in recent_purchases:
        activity.append(
            DashboardActivityItem(
                type="purchase",
                id=p.id,
                reference=p.supplier.name,
                amount=p.total_amount,
                date=p.purchase_date
            )
        )

    for s in recent_sales:
        activity.append(
            DashboardActivityItem(
                type="sale",
                id=s.id,
                reference=s.customer.name if s.customer else "Walk-in Customer",
                amount=s.total_amount,
                date=s.sale_date
            )
        )

    activity.sort(key=lambda a: a.date, reverse=True)
    return activity[:limit]


@router.get("/low-stock", response_model=list[ProductResponse])
def get_low_stock_products(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Product).filter(
        Product.quantity <= Product.reorder_level
    ).all()


@router.get("/out-of-stock", response_model=list[ProductResponse])
def get_out_of_stock_products(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Product).filter(
        Product.quantity == 0
    ).all()


@router.get("/inventory-value", response_model=InventoryValueResponse)
def get_inventory_value(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return InventoryValueResponse(
        total_inventory_value=_inventory_value(db),
        total_products=db.query(Product).count()
    )


@router.get("/top-selling-products", response_model=list[TopSellingProductItem])
def get_top_selling_products(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    results = (
        db.query(
            Product.id,
            Product.name,
            func.sum(SalesOrderItem.quantity).label("total_quantity_sold"),
            func.sum(SalesOrderItem.subtotal).label("total_revenue")
        )
        .join(SalesOrderItem, SalesOrderItem.product_id == Product.id)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(SalesOrderItem.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        TopSellingProductItem(
            product_id=r.id,
            product_name=r.name,
            total_quantity_sold=r.total_quantity_sold,
            total_revenue=r.total_revenue
        )
        for r in results
    ]


@router.get("/top-purchased-products", response_model=list[TopPurchasedProductItem])
def get_top_purchased_products(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    results = (
        db.query(
            Product.id,
            Product.name,
            func.sum(PurchaseItem.quantity).label("total_quantity_purchased")
        )
        .join(PurchaseItem, PurchaseItem.product_id == Product.id)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(PurchaseItem.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        TopPurchasedProductItem(
            product_id=r.id,
            product_name=r.name,
            total_quantity_purchased=r.total_quantity_purchased
        )
        for r in results
    ]


@router.get("/monthly-sales", response_model=list[MonthlyTrendItem])
def get_monthly_sales(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    month_expr = func.to_char(SalesOrder.sale_date, "YYYY-MM")

    results = (
        db.query(
            month_expr.label("month"),
            func.sum(SalesOrder.total_amount).label("total_amount"),
            func.count(SalesOrder.id).label("count")
        )
        .group_by(month_expr)
        .order_by(month_expr.desc())
        .limit(months)
        .all()
    )

    trend = [
        MonthlyTrendItem(month=r.month, total_amount=r.total_amount, count=r.count)
        for r in results
    ]
    return list(reversed(trend))  # oldest -> newest, for charting left to right


@router.get("/monthly-purchases", response_model=list[MonthlyTrendItem])
def get_monthly_purchases(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    month_expr = func.to_char(Purchase.purchase_date, "YYYY-MM")

    results = (
        db.query(
            month_expr.label("month"),
            func.sum(Purchase.total_amount).label("total_amount"),
            func.count(Purchase.id).label("count")
        )
        .group_by(month_expr)
        .order_by(month_expr.desc())
        .limit(months)
        .all()
    )

    trend = [
        MonthlyTrendItem(month=r.month, total_amount=r.total_amount, count=r.count)
        for r in results
    ]
    return list(reversed(trend))


@router.get("/category-distribution", response_model=list[CategoryDistributionItem])
def get_category_distribution(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    results = (
        db.query(
            Category.id,
            Category.name,
            func.count(Product.id).label("product_count")
        )
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Category.id, Category.name)
        .all()
    )

    return [
        CategoryDistributionItem(
            category_id=r.id,
            category_name=r.name,
            product_count=r.product_count
        )
        for r in results
    ]


@router.get("/dead-stock", response_model=list[DeadStockItem])
def get_dead_stock(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Products that haven't sold in the last `days` days (default 30).
    Includes products that have NEVER been sold.
    Only returns products that currently have stock (quantity > 0) —
    out-of-stock products are already flagged by /dashboard/out-of-stock.

    Query param: ?days=30  (or 60, 90, etc.)
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Subquery: latest sale date per product within the cutoff window.
    # We use a LEFT JOIN so products with zero sales still appear as NULL.
    last_sale_subq = (
        db.query(
            SalesOrderItem.product_id,
            func.max(SalesOrder.sale_date).label("last_sold_at")
        )
        .join(SalesOrder, SalesOrderItem.sales_order_id == SalesOrder.id)
        .group_by(SalesOrderItem.product_id)
        .subquery()
    )

    results = (
        db.query(
            Product,
            last_sale_subq.c.last_sold_at
        )
        .outerjoin(last_sale_subq, last_sale_subq.c.product_id == Product.id)
        .filter(
            Product.quantity > 0,               # only products that are in stock
            (last_sale_subq.c.last_sold_at < cutoff) |  # sold, but not recently
            (last_sale_subq.c.last_sold_at == None)      # or never sold at all
        )
        .order_by(last_sale_subq.c.last_sold_at.asc().nullsfirst())
        .all()
    )

    now = datetime.now(timezone.utc)
    items = []
    for product, last_sold_at in results:
        if last_sold_at is not None:
            # Ensure both sides are offset-aware for the subtraction
            if last_sold_at.tzinfo is None:
                last_sold_at = last_sold_at.replace(tzinfo=timezone.utc)
            days_since = (now - last_sold_at).days
        else:
            days_since = None

        items.append(
            DeadStockItem(
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=product.quantity,
                cost_price=product.cost_price,
                stock_value=product.quantity * product.cost_price,
                last_sold_at=last_sold_at,
                days_since_last_sale=days_since
            )
        )

    return items