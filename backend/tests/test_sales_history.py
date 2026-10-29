"""
Tests for SalesHistoryService:
- Inclusion of SHIPPED, DELIVERED, and COMPLETED orders.
- Exclusion of DRAFT, CONFIRMED, PACKED, and CANCELLED orders.
- Multiple products and multiple order items without double-counting.
- Continuous daily calendar generation and zero imputation.
- Gross versus return-adjusted demand reconciliation.
- Zero sales versus stockout days differentiation.
- Stockout transitions and uncertain historical intervals.
- Read-only assertions (zero database mutations).
- Forecast API compatibility and stockout warning emission.
"""
import sys
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
import pandas as pd
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Ensure backend and ML packages on path
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.database.database import Base
from app.models.role_model import Role
from app.models.user_model import User
from app.models.category_model import Category
from app.models.supplier_model import Supplier
from app.models.product_model import Product
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.sales_return_model import SalesReturn, SalesReturnItem
from app.models.inventory_log_model import InventoryLog
from app.services.sales_history_service import SalesHistoryService
from app.services.forecast_service import generate_forecast, get_continuous_sales_history


@pytest.fixture
def db_session():
    """Create a pristine SQLite in-memory database session for each test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed required reference entities
    role = Role(id=1, name="admin", description="Administrator")
    user = User(id=1, username="admin", email="admin@example.com", password_hash="pw", role_id=1)
    category = Category(id=1, name="Electronics")
    supplier = Supplier(id=1, name="Acme Corp", email="acme@example.com", phone="1234567890")
    session.add_all([role, user, category, supplier])
    session.commit()

    yield session

    session.close()


def test_inclusion_of_fulfilled_order_statuses(db_session):
    """Verify orders in SHIPPED, DELIVERED, and COMPLETED are aggregated."""
    product = Product(
        id=1,
        name="Laptop",
        sku="SKU-LAP-01",
        quantity=50,
        cost_price=Decimal("500.00"),
        selling_price=Decimal("800.00"),
        reorder_level=5,
        category_id=1,
        supplier_id=1,
    )
    db_session.add(product)
    db_session.commit()

    d1 = date(2026, 10, 10)
    d2 = date(2026, 10, 11)
    d3 = date(2026, 10, 12)

    # 1. SHIPPED order
    so1 = SalesOrder(id=1, user_id=1, status="SHIPPED", sale_date=datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("1600.00"))
    item1 = SalesOrderItem(id=1, sales_order_id=1, product_id=1, quantity=2, unit_price=Decimal("800.00"), subtotal=Decimal("1600.00"))

    # 2. DELIVERED order
    so2 = SalesOrder(id=2, user_id=1, status="DELIVERED", sale_date=datetime(2026, 10, 11, 14, 0, tzinfo=timezone.utc), total_amount=Decimal("2400.00"))
    item2 = SalesOrderItem(id=2, sales_order_id=2, product_id=1, quantity=3, unit_price=Decimal("800.00"), subtotal=Decimal("2400.00"))

    # 3. COMPLETED order
    so3 = SalesOrder(id=3, user_id=1, status="COMPLETED", sale_date=datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc), total_amount=Decimal("4000.00"))
    item3 = SalesOrderItem(id=3, sales_order_id=3, product_id=1, quantity=5, unit_price=Decimal("800.00"), subtotal=Decimal("4000.00"))

    db_session.add_all([so1, item1, so2, item2, so3, item3])
    db_session.commit()

    df = SalesHistoryService.get_product_daily_demand(
        db=db_session,
        product_id=1,
        start_date=d1,
        end_date=d3,
        demand_type="gross",
    )

    assert len(df) == 3
    assert df.loc[pd.Timestamp(d1), "gross_demand"] == 2.0
    assert df.loc[pd.Timestamp(d2), "gross_demand"] == 3.0
    assert df.loc[pd.Timestamp(d3), "gross_demand"] == 5.0
    assert df["gross_demand"].sum() == 10.0


def test_exclusion_of_unfulfilled_order_statuses(db_session):
    """Verify DRAFT, CONFIRMED, PACKED, and CANCELLED orders are strictly ignored."""
    product = Product(
        id=2,
        name="Mouse",
        sku="SKU-MOU-01",
        quantity=20,
        cost_price=Decimal("10.00"),
        selling_price=Decimal("25.00"),
        reorder_level=5,
        category_id=1,
        supplier_id=1,
    )
    db_session.add(product)
    db_session.commit()

    target_date = date(2026, 10, 15)
    dt = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)

    # Add unfulfilled orders
    so_draft = SalesOrder(id=10, user_id=1, status="DRAFT", sale_date=dt, total_amount=Decimal("250.00"))
    it_draft = SalesOrderItem(id=10, sales_order_id=10, product_id=2, quantity=10, unit_price=Decimal("25.00"), subtotal=Decimal("250.00"))

    so_confirmed = SalesOrder(id=11, user_id=1, status="CONFIRMED", sale_date=dt, total_amount=Decimal("100.00"))
    it_confirmed = SalesOrderItem(id=11, sales_order_id=11, product_id=2, quantity=4, unit_price=Decimal("25.00"), subtotal=Decimal("100.00"))

    so_packed = SalesOrder(id=12, user_id=1, status="PACKED", sale_date=dt, total_amount=Decimal("50.00"))
    it_packed = SalesOrderItem(id=12, sales_order_id=12, product_id=2, quantity=2, unit_price=Decimal("25.00"), subtotal=Decimal("50.00"))

    so_cancelled = SalesOrder(id=13, user_id=1, status="CANCELLED", sale_date=dt, total_amount=Decimal("500.00"))
    it_cancelled = SalesOrderItem(id=13, sales_order_id=13, product_id=2, quantity=20, unit_price=Decimal("25.00"), subtotal=Decimal("500.00"))

    db_session.add_all([
        so_draft, it_draft,
        so_confirmed, it_confirmed,
        so_packed, it_packed,
        so_cancelled, it_cancelled
    ])
    db_session.commit()

    df = SalesHistoryService.get_product_daily_demand(
        db=db_session,
        product_id=2,
        start_date=target_date,
        end_date=target_date,
        demand_type="gross",
    )

    assert len(df) == 1
    assert df.loc[pd.Timestamp(target_date), "gross_demand"] == 0.0
    assert df.loc[pd.Timestamp(target_date), "order_count"] == 0


def test_multiple_products_and_order_items_no_double_counting(db_session):
    """Verify multi-item orders do not double-count quantities across products."""
    p1 = Product(id=10, name="Item A", sku="SKU-A", quantity=50, cost_price=Decimal("5"), selling_price=Decimal("10"), reorder_level=5, category_id=1, supplier_id=1)
    p2 = Product(id=11, name="Item B", sku="SKU-B", quantity=50, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
    db_session.add_all([p1, p2])
    db_session.commit()

    sale_dt = datetime(2026, 10, 14, 15, 0, tzinfo=timezone.utc)
    target_d = sale_dt.date()

    # One order with line items for both product 10 and product 11
    so = SalesOrder(id=20, user_id=1, status="SHIPPED", sale_date=sale_dt, total_amount=Decimal("100.00"))
    it1 = SalesOrderItem(id=21, sales_order_id=20, product_id=10, quantity=4, unit_price=Decimal("10.00"), subtotal=Decimal("40.00"))
    it2 = SalesOrderItem(id=22, sales_order_id=20, product_id=11, quantity=3, unit_price=Decimal("20.00"), subtotal=Decimal("60.00"))

    db_session.add_all([so, it1, it2])
    db_session.commit()

    df_p1 = SalesHistoryService.get_product_daily_demand(db_session, 10, target_d, target_d)
    df_p2 = SalesHistoryService.get_product_daily_demand(db_session, 11, target_d, target_d)

    assert df_p1.loc[pd.Timestamp(target_d), "gross_demand"] == 4.0
    assert df_p2.loc[pd.Timestamp(target_d), "gross_demand"] == 3.0


def test_continuous_daily_calendar_generation(db_session):
    """Verify days without transactions are filled with 0.0 over continuous calendar."""
    product = Product(id=3, name="Keyboard", sku="SKU-KB-01", quantity=30, cost_price=Decimal("20"), selling_price=Decimal("40"), reorder_level=5, category_id=1, supplier_id=1)
    db_session.add(product)
    db_session.commit()

    # Sale on Oct 1 and Oct 5; Oct 2, 3, 4 have no sales
    d1 = date(2026, 10, 1)
    d5 = date(2026, 10, 5)

    so1 = SalesOrder(id=31, user_id=1, status="SHIPPED", sale_date=datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("40.00"))
    it1 = SalesOrderItem(id=31, sales_order_id=31, product_id=3, quantity=1, unit_price=Decimal("40.00"), subtotal=Decimal("40.00"))

    so2 = SalesOrder(id=32, user_id=1, status="SHIPPED", sale_date=datetime(2026, 10, 5, 11, 0, tzinfo=timezone.utc), total_amount=Decimal("80.00"))
    it2 = SalesOrderItem(id=32, sales_order_id=32, product_id=3, quantity=2, unit_price=Decimal("40.00"), subtotal=Decimal("80.00"))

    db_session.add_all([so1, it1, so2, it2])
    db_session.commit()

    df = SalesHistoryService.get_product_daily_demand(db_session, 3, d1, d5)

    assert len(df) == 5
    assert df.loc[pd.Timestamp("2026-10-01"), "gross_demand"] == 1.0
    assert df.loc[pd.Timestamp("2026-10-02"), "gross_demand"] == 0.0
    assert df.loc[pd.Timestamp("2026-10-03"), "gross_demand"] == 0.0
    assert df.loc[pd.Timestamp("2026-10-04"), "gross_demand"] == 0.0
    assert df.loc[pd.Timestamp("2026-10-05"), "gross_demand"] == 2.0


def test_gross_vs_return_adjusted_demand(db_session):
    """Verify returns are reconciled against the original sale date and never produce negative demand."""
    product = Product(id=4, name="Monitor", sku="SKU-MON-01", quantity=15, cost_price=Decimal("100"), selling_price=Decimal("150"), reorder_level=3, category_id=1, supplier_id=1)
    db_session.add(product)
    db_session.commit()

    # Sold 5 units on Oct 2
    sale_dt = datetime(2026, 10, 2, 10, 0, tzinfo=timezone.utc)
    so = SalesOrder(id=40, user_id=1, status="SHIPPED", sale_date=sale_dt, total_amount=Decimal("750.00"))
    item = SalesOrderItem(id=41, sales_order_id=40, product_id=4, quantity=5, unit_price=Decimal("150.00"), subtotal=Decimal("750.00"))
    db_session.add_all([so, item])
    db_session.commit()

    # Return of 2 units processed on Oct 10 (linked to order 40)
    ret_dt = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)
    sr = SalesReturn(id=1, sales_order_id=40, return_date=ret_dt, status="PROCESSED", created_by=1, total_refund_amount=Decimal("300.00"))
    sr_item = SalesReturnItem(id=1, sales_return_id=1, product_id=4, quantity=2, refund_amount=Decimal("300.00"))
    db_session.add_all([sr, sr_item])
    db_session.commit()

    start_d = date(2026, 10, 2)
    end_d = date(2026, 10, 10)

    # Check gross demand
    df_gross = SalesHistoryService.get_product_daily_demand(db_session, 4, start_d, end_d, demand_type="gross")
    assert df_gross.loc[pd.Timestamp("2026-10-02"), "units"] == 5.0
    assert df_gross.loc[pd.Timestamp("2026-10-10"), "units"] == 0.0  # Return date does not invent sales

    # Check net demand (returns reconciled to sale date)
    df_net = SalesHistoryService.get_product_daily_demand(db_session, 4, start_d, end_d, demand_type="net")
    assert df_net.loc[pd.Timestamp("2026-10-02"), "units"] == 3.0  # 5 gross - 2 returned = 3 net
    assert df_net.loc[pd.Timestamp("2026-10-02"), "net_demand"] == 3.0
    assert df_net.loc[pd.Timestamp("2026-10-10"), "units"] == 0.0  # Net demand is non-negative, never -2.0


def test_zero_sales_vs_stockout_days(db_session):
    """Distinguish zero sales when stock was available versus when stock was 0."""
    product = Product(id=5, name="Cable", sku="SKU-CAB-01", quantity=0, cost_price=Decimal("2"), selling_price=Decimal("5"), reorder_level=5, category_id=1, supplier_id=1)
    db_session.add(product)
    db_session.commit()

    # Log 1: Oct 1, sold last units, quantity becomes 0 (stockout starts)
    t1 = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
    l1 = InventoryLog(id=1, product_id=5, change_type="SALE", reference_type="SALES_ORDER", reference_id=101, quantity_changed=-3, previous_quantity=3, new_quantity=0, timestamp=t1)

    # Log 2: Oct 4, replenishment received, quantity becomes 10 (stockout ends)
    t2 = datetime(2026, 10, 4, 14, 0, tzinfo=timezone.utc)
    l2 = InventoryLog(id=2, product_id=5, change_type="PURCHASE_RECEIPT", reference_type="purchase", reference_id=50, quantity_changed=10, previous_quantity=0, new_quantity=10, timestamp=t2)

    db_session.add_all([l1, l2])
    db_session.commit()

    cal = SalesHistoryService.get_stockout_calendar(
        db=db_session,
        product_id=5,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 6),
    )

    # Oct 1, 2, 3: ending stock was 0 -> STOCKOUT
    assert cal[date(2026, 10, 1)]["is_stockout"] is True
    assert cal[date(2026, 10, 1)]["status"] == "STOCKOUT"
    assert cal[date(2026, 10, 2)]["is_stockout"] is True
    assert cal[date(2026, 10, 3)]["is_stockout"] is True

    # Oct 4, 5, 6: replenished -> AVAILABLE
    assert cal[date(2026, 10, 4)]["is_stockout"] is False
    assert cal[date(2026, 10, 4)]["status"] == "AVAILABLE"
    assert cal[date(2026, 10, 5)]["is_stockout"] is False
    assert cal[date(2026, 10, 6)]["is_stockout"] is False


def test_stockout_transitions_and_uncertain_intervals(db_session):
    """Verify pre-log dates are marked UNCERTAIN rather than fabricating historical availability."""
    product = Product(id=6, name="Speaker", sku="SKU-SPK-01", quantity=10, cost_price=Decimal("30"), selling_price=Decimal("60"), reorder_level=2, category_id=1, supplier_id=1)
    db_session.add(product)
    db_session.commit()

    # Earliest log is Oct 10
    t_log = datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc)
    log = InventoryLog(id=3, product_id=6, change_type="SALE", reference_type="SALES_ORDER", reference_id=102, quantity_changed=-2, previous_quantity=12, new_quantity=10, timestamp=t_log)
    db_session.add(log)
    db_session.commit()

    cal = SalesHistoryService.get_stockout_calendar(
        db=db_session,
        product_id=6,
        start_date=date(2026, 10, 5),
        end_date=date(2026, 10, 12),
    )

    # Dates before Oct 10 must be UNCERTAIN
    for d in [date(2026, 10, 5), date(2026, 10, 6), date(2026, 10, 7), date(2026, 10, 8), date(2026, 10, 9)]:
        assert cal[d]["status"] == "UNCERTAIN"
        assert cal[d]["is_stockout"] is False

    # Oct 10 onward: AVAILABLE
    assert cal[date(2026, 10, 10)]["status"] == "AVAILABLE"
    assert cal[date(2026, 10, 11)]["status"] == "AVAILABLE"
    assert cal[date(2026, 10, 12)]["status"] == "AVAILABLE"


def test_no_database_mutations_during_history_queries(db_session):
    """Assert get_product_daily_demand and get_stockout_calendar execute zero database mutations."""
    product = Product(id=7, name="Desk", sku="SKU-DSK-01", quantity=5, cost_price=Decimal("100"), selling_price=Decimal("150"), reorder_level=2, category_id=1, supplier_id=1)
    db_session.add(product)
    db_session.commit()

    mutation_detected = False

    @event.listens_for(db_session, "before_flush")
    def receive_before_flush(session, flush_context, instances):
        nonlocal mutation_detected
        mutation_detected = True

    df = SalesHistoryService.get_product_daily_demand(db_session, 7, date(2026, 10, 1), date(2026, 10, 10))
    cal = SalesHistoryService.get_stockout_calendar(db_session, 7, date(2026, 10, 1), date(2026, 10, 10))

    assert not mutation_detected
    assert len(df) == 10
    assert len(cal) == 10


def test_forecast_integration_and_stockout_warning(db_session):
    """Verify forecast_service exposes stockout metadata and appends stockout warning."""
    product = Product(id=8, name="Webcam", sku="SKU-CAM-01", quantity=0, cost_price=Decimal("40"), selling_price=Decimal("80"), reorder_level=5, category_id=1, supplier_id=1)
    db_session.add(product)
    db_session.commit()

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    d_sale = yesterday - timedelta(days=10)

    # 1. Fulfilled sale 10 days ago
    so = SalesOrder(id=80, user_id=1, status="SHIPPED", sale_date=datetime(d_sale.year, d_sale.month, d_sale.day, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("160.00"))
    it = SalesOrderItem(id=81, sales_order_id=80, product_id=8, quantity=2, unit_price=Decimal("80.00"), subtotal=Decimal("160.00"))

    # 2. Stock dropped to 0 on that day (10 stockout days accumulated)
    log = InventoryLog(id=80, product_id=8, change_type="SALE", reference_type="SALES_ORDER", reference_id=80, quantity_changed=-2, previous_quantity=2, new_quantity=0, timestamp=datetime(d_sale.year, d_sale.month, d_sale.day, 10, 0, tzinfo=timezone.utc))

    db_session.add_all([so, it, log])
    db_session.commit()

    result = generate_forecast(db_session, product_id=8, horizon_days=7)

    assert result["product_id"] == 8
    assert result["stockout_days_detected"] > 0
    assert any("stockout day" in w for w in result["warnings"])
