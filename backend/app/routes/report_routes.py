from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from decimal import Decimal
from pydantic import BaseModel
import csv
import io

from app.database.database import get_db

from app.models.sale_model import Sale
from app.models.sale_item_model import SaleItem
from app.models.purchase_model import Purchase
from app.models.purchase_item_model import PurchaseItem
from app.models.product_model import Product
from app.models.category_model import Category
from app.models.inventory_log_model import InventoryLog

from app.models.report_schema import (
    SalesReportItem,
    PurchasesReportItem,
    InventoryReportItem,
    ProfitLossReportItem,
    StockValuationReportItem,
    AuditTrailReportItem
)

from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)


# ---------- generic CSV formatter, shared by every report ----------
# Reads column names straight off the Pydantic model's field order, so the
# CSV header can never drift out of sync with the JSON route's field names.

def _to_csv(model_cls: type[BaseModel], items: list[BaseModel], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    header = list(model_cls.model_fields.keys())
    writer.writerow(header)

    for item in items:
        writer.writerow(list(item.model_dump().values()))

    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ---------- Sales ----------

def _get_sales_report_data(
    db: Session, start_date: date | None, end_date: date | None
) -> list[SalesReportItem]:
    query = (
        db.query(SaleItem, Sale, Product)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
    )

    if start_date:
        query = query.filter(Sale.sale_date >= start_date)
    if end_date:
        query = query.filter(Sale.sale_date <= end_date)

    results = query.order_by(Sale.sale_date.asc()).all()

    return [
        SalesReportItem(
            sale_id=sale.id,
            sale_date=sale.sale_date,
            customer_name=sale.customer_name or "Walk-in Customer",
            payment_method=sale.payment_method or "",
            product_id=product.id,
            product_name=product.name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            sale_total_amount=sale.total_amount
        )
        for item, sale, product in results
    ]


@router.get("/sales", response_model=list[SalesReportItem])
def get_sales_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return _get_sales_report_data(db, start_date, end_date)


@router.get("/sales/export")
def export_sales_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    items = _get_sales_report_data(db, start_date, end_date)
    return _to_csv(SalesReportItem, items, "sales_report.csv")


# ---------- Purchases ----------

def _get_purchases_report_data(
    db: Session, start_date: date | None, end_date: date | None
) -> list[PurchasesReportItem]:
    query = (
        db.query(PurchaseItem, Purchase, Product)
        .join(Purchase, PurchaseItem.purchase_id == Purchase.id)
        .join(Product, PurchaseItem.product_id == Product.id)
    )

    if start_date:
        query = query.filter(Purchase.purchase_date >= start_date)
    if end_date:
        query = query.filter(Purchase.purchase_date <= end_date)

    results = query.order_by(Purchase.purchase_date.asc()).all()

    return [
        PurchasesReportItem(
            purchase_id=purchase.id,
            purchase_date=purchase.purchase_date,
            supplier_name=purchase.supplier.name,
            status=purchase.status,
            product_id=product.id,
            product_name=product.name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
            purchase_total_amount=purchase.total_amount
        )
        for item, purchase, product in results
    ]


@router.get("/purchases", response_model=list[PurchasesReportItem])
def get_purchases_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return _get_purchases_report_data(db, start_date, end_date)


@router.get("/purchases/export")
def export_purchases_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    items = _get_purchases_report_data(db, start_date, end_date)
    return _to_csv(PurchasesReportItem, items, "purchases_report.csv")


# ---------- Inventory ----------

def _get_inventory_report_data(db: Session) -> list[InventoryReportItem]:
    products = db.query(Product).all()

    return [
        InventoryReportItem(
            product_id=p.id,
            name=p.name,
            sku=p.sku,
            category=p.category.name,
            supplier=p.supplier.name,
            quantity=p.quantity,
            reorder_level=p.reorder_level,
            cost_price=p.cost_price,
            selling_price=p.selling_price,
            inventory_value=p.quantity * p.cost_price
        )
        for p in products
    ]


@router.get("/inventory", response_model=list[InventoryReportItem])
def get_inventory_report(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return _get_inventory_report_data(db)


@router.get("/inventory/export")
def export_inventory_report(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    items = _get_inventory_report_data(db)
    return _to_csv(InventoryReportItem, items, "inventory_report.csv")


# ---------- Profit & Loss ----------
# New sales use SaleItem.cost_price_at_sale so historical profit remains
# correct even if Product.cost_price changes later. Pre-migration sale items
# may have NULL cost_price_at_sale, so they safely fall back to current cost.

def _get_profit_loss_report_data(
    db: Session, start_date: date | None, end_date: date | None
) -> list[ProfitLossReportItem]:
    query = (
        db.query(SaleItem, Sale, Product)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
    )

    if start_date:
        query = query.filter(Sale.sale_date >= start_date)
    if end_date:
        query = query.filter(Sale.sale_date <= end_date)

    results = query.order_by(Sale.sale_date.asc()).all()

    items = []
    for item, sale, product in results:
        revenue = item.subtotal

        # New sales use the historical cost captured when the sale happened.
        # Old sales created before the migration have NULL here,
        # so fall back to the current product cost.
        cost_price = (
            item.cost_price_at_sale
            if item.cost_price_at_sale is not None
            else product.cost_price
        )

        cost = item.quantity * cost_price
        profit = revenue - cost

        margin_pct = (
            (profit / revenue * Decimal("100"))
            if revenue > 0
            else Decimal("0")
        )

        items.append(
            ProfitLossReportItem(
                sale_id=sale.id,
                sale_date=sale.sale_date,
                product_id=product.id,
                product_name=product.name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                cost_price_at_sale=cost_price,
                revenue=revenue,
                cost=cost,
                profit=profit,
                margin_pct=round(margin_pct, 2)
            )
        )

    return items


@router.get("/profit-loss", response_model=list[ProfitLossReportItem])
def get_profit_loss_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return _get_profit_loss_report_data(db, start_date, end_date)


@router.get("/profit-loss/export")
def export_profit_loss_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    items = _get_profit_loss_report_data(db, start_date, end_date)
    return _to_csv(ProfitLossReportItem, items, "profit_loss_report.csv")


# ---------- Stock Valuation ----------

def _get_stock_valuation_report_data(db: Session) -> list[StockValuationReportItem]:
    results = (
        db.query(
            Category.id,
            Category.name,
            func.count(Product.id).label("product_count"),
            func.coalesce(func.sum(Product.quantity), 0).label("total_quantity"),
            func.coalesce(
                func.sum(Product.quantity * Product.cost_price), Decimal("0")
            ).label("total_value")
        )
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Category.id, Category.name)
        .order_by(Category.name.asc())
        .all()
    )

    items = [
        StockValuationReportItem(
            category_id=r.id,
            category_name=r.name,
            product_count=r.product_count,
            total_quantity=r.total_quantity,
            total_value=r.total_value
        )
        for r in results
    ]

    grand_total_value = sum((i.total_value for i in items), Decimal("0"))
    grand_total_qty = sum((i.total_quantity for i in items), 0)
    grand_total_products = sum(i.product_count for i in items)

    items.append(
        StockValuationReportItem(
            category_id=None,
            category_name="TOTAL",
            product_count=grand_total_products,
            total_quantity=grand_total_qty,
            total_value=grand_total_value
        )
    )

    return items


@router.get("/stock-valuation", response_model=list[StockValuationReportItem])
def get_stock_valuation_report(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return _get_stock_valuation_report_data(db)


@router.get("/stock-valuation/export")
def export_stock_valuation_report(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    items = _get_stock_valuation_report_data(db)
    return _to_csv(StockValuationReportItem, items, "stock_valuation_report.csv")


# ---------- Audit Trail ----------

def _get_audit_trail_report_data(
    db: Session, start_date: date | None, end_date: date | None
) -> list[AuditTrailReportItem]:
    query = (
        db.query(InventoryLog, Product)
        .join(Product, InventoryLog.product_id == Product.id)
    )

    if start_date:
        query = query.filter(InventoryLog.timestamp >= start_date)
    if end_date:
        query = query.filter(InventoryLog.timestamp <= end_date)

    results = query.order_by(InventoryLog.timestamp.asc()).all()

    return [
        AuditTrailReportItem(
            log_id=log.id,
            timestamp=log.timestamp,
            product_id=product.id,
            product_name=product.name,
            change_type=log.change_type,
            reference_type=log.reference_type,
            reference_id=log.reference_id,
            quantity_changed=log.quantity_changed,
            previous_quantity=log.previous_quantity,
            new_quantity=log.new_quantity
        )
        for log, product in results
    ]


@router.get("/audit-trail", response_model=list[AuditTrailReportItem])
def get_audit_trail_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return _get_audit_trail_report_data(db, start_date, end_date)


@router.get("/audit-trail/export")
def export_audit_trail_report(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    items = _get_audit_trail_report_data(db, start_date, end_date)
    return _to_csv(AuditTrailReportItem, items, "audit_trail_report.csv")