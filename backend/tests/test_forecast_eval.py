"""
Tests for forecast_eval_service:
- Mathematical accuracy of MAE, RMSE, WAPE, Bias.
- Boundary condition: WAPE undefined when sum(actuals) == 0.
- Boundary condition: WAPE low volume volatility flag when sum(actuals) < 10.
- Stockout-censored masking: stockout days excluded from demand error calculation.
- Backtesting readiness gating: distinguishes real observations from calendar-imputed zeros.
- Catalog readiness summary generation.
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import numpy as np
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base
from app.models.role_model import Role
from app.models.user_model import User
from app.models.category_model import Category
from app.models.supplier_model import Supplier
from app.models.product_model import Product
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.inventory_log_model import InventoryLog
from app.models.sales_return_model import SalesReturn, SalesReturnItem
from app.services.forecast_eval_service import (
    calculate_forecast_metrics,
    assess_product_backtest_readiness,
    generate_catalog_readiness_audit,
    get_product_demand_classification,
    run_chronological_baseline_backtest,
)

@pytest.fixture
def eval_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    session.add_all([
        Role(id=1, name="admin"),
        User(id=1, username="admin", email="admin@example.com", password_hash="pw", role_id=1),
        Category(id=1, name="Electronics"),
        Supplier(id=1, name="Supplier 1", email="s1@example.com", phone="123"),
    ])
    session.commit()
    session.close()
    return engine


@pytest.fixture
def eval_db(eval_engine):
    Session = sessionmaker(bind=eval_engine)
    session = Session()
    yield session
    session.close()


def test_metric_calculations_standard():
    actuals = [10.0, 20.0, 30.0, 40.0]
    preds = [12.0, 18.0, 33.0, 37.0]

    res = calculate_forecast_metrics(actuals, preds)

    assert res["status"] == "VALID"
    assert res["total_observations"] == 4
    assert res["evaluated_observations"] == 4
    assert res["masked_stockout_count"] == 0
    # errors: +2, -2, +3, -3 -> abs: 2, 2, 3, 3 -> sum=10, mean=2.5
    assert res["mae"] == 2.5
    # squared: 4, 4, 9, 9 -> sum=26, mean=6.5 -> sqrt(6.5) = 2.5495
    assert abs(res["rmse"] - 2.5495) < 1e-3
    # sum actuals = 100, sum abs errors = 10 -> WAPE = 10 / 100 = 0.10 (10%)
    assert res["wape"] == 0.10
    assert res["wape_diagnostic"] == "VALID"
    # bias: mean(errors) = 0.0
    assert res["bias"] == 0.0


def test_wape_undefined_when_zero_demand():
    actuals = [0.0, 0.0, 0.0, 0.0, 0.0]
    preds = [0.5, 0.5, 0.2, 0.0, 0.1]

    res = calculate_forecast_metrics(actuals, preds)

    assert res["status"] == "VALID"
    assert res["wape"] is None
    assert res["wape_diagnostic"] == "UNDEFINED_ZERO_DEMAND_DENOMINATOR"
    assert res["total_actual_demand"] == 0.0
    assert res["mae"] == 0.26


def test_wape_low_volume_volatility_flag():
    actuals = [1.0, 0.0, 0.0, 0.0]  # total actual demand = 1.0 < 10
    preds = [2.0, 0.5, 0.0, 0.0]

    res = calculate_forecast_metrics(actuals, preds)

    assert res["status"] == "VALID"
    assert res["wape"] is not None
    assert res["wape_diagnostic"] == "LOW_VOLUME_VOLATILITY"


def test_stockout_censoring_masking():
    # Day 3 and Day 4 were stockout days (stock was 0)
    actuals = [10.0, 15.0, 0.0, 0.0]
    preds = [10.0, 15.0, 5.0, 8.0]
    stockouts = [False, False, True, True]

    res = calculate_forecast_metrics(actuals, preds, stockout_mask=stockouts)

    assert res["status"] == "VALID"
    assert res["total_observations"] == 4
    assert res["evaluated_observations"] == 2
    assert res["masked_stockout_count"] == 2
    # Days 1 and 2 had exact predictions: MAE should be 0.0, not penalized for anticipating demand on stockout days
    assert res["mae"] == 0.0
    assert res["rmse"] == 0.0
    assert res["wape"] == 0.0


def test_readiness_assessment_zero_history(eval_db):
    p = Product(id=1, name="NoHistory", sku="SKU-01", quantity=10, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
    eval_db.add(p)
    eval_db.commit()

    report = assess_product_backtest_readiness(eval_db, 1)

    assert report["is_eligible_for_backtest"] is False
    assert report["readiness_status"] == "INSUFFICIENT_OBSERVATIONS"
    assert report["genuine_observations"]["fulfilled_orders"] == 0
    assert "Zero fulfilled sales orders recorded." in report["blockers"]


def test_readiness_assessment_sparse_calendar_zeros(eval_db):
    """
    Verify that an isolated sale 80 days ago does NOT pass readiness
    just because calendar reindexing creates an 80-day series.
    """
    p = Product(id=2, name="SparseHistory", sku="SKU-02", quantity=20, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
    eval_db.add(p)
    eval_db.commit()

    d1 = date(2026, 7, 1)
    d2 = date(2026, 9, 20)  # 81 calendar days, but only 2 distinct sale days

    so1 = SalesOrder(id=1, user_id=1, status="SHIPPED", sale_date=datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("10"))
    it1 = SalesOrderItem(id=1, sales_order_id=1, product_id=2, quantity=1, unit_price=Decimal("10"), subtotal=Decimal("10"))

    so2 = SalesOrder(id=2, user_id=1, status="DELIVERED", sale_date=datetime(2026, 9, 20, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("10"))
    it2 = SalesOrderItem(id=2, sales_order_id=2, product_id=2, quantity=1, unit_price=Decimal("10"), subtotal=Decimal("10"))

    eval_db.add_all([so1, it1, so2, it2])
    eval_db.commit()

    report = assess_product_backtest_readiness(eval_db, 2)

    assert report["is_eligible_for_backtest"] is False
    assert report["genuine_observations"]["distinct_sale_dates"] == 2
    assert report["calendar_metrics"]["calendar_span_days"] == 82
    assert report["calendar_metrics"]["observation_density"] < 0.05
    # Blockers must indicate insufficient distinct dates and low density
    assert any("distinct sale dates" in b for b in report["blockers"])
    assert any("density" in b for b in report["blockers"])


def test_catalog_readiness_audit_overall(eval_db):
    p1 = Product(id=10, name="P1", sku="SKU-10", quantity=5, cost_price=Decimal("5"), selling_price=Decimal("10"), reorder_level=2, category_id=1, supplier_id=1)
    p2 = Product(id=20, name="P2", sku="SKU-20", quantity=5, cost_price=Decimal("5"), selling_price=Decimal("10"), reorder_level=2, category_id=1, supplier_id=1)
    eval_db.add_all([p1, p2])
    eval_db.commit()

    audit = generate_catalog_readiness_audit(eval_db)

    assert audit["total_catalog_products"] == 2
    assert audit["eligible_for_backtesting_count"] == 0
    assert audit["readiness_summary"] == "NO_ELIGIBLE_PRODUCTS"
    assert len(audit["products"]) == 2


def test_get_product_demand_classification(eval_db):
    """
    Verify classification of calendar days into:
    - GENUINE_TRANSACTION
    - CONFIRMED_ZERO
    - STOCKOUT_CENSORED
    - UNCERTAIN_AVAILABILITY
    """
    p = Product(id=30, name="ClassifiedProd", sku="SKU-30", quantity=10, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
    eval_db.add(p)
    eval_db.commit()

    # Log on Oct 1: stock becomes 10 (availability established)
    t_log = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)
    l1 = InventoryLog(id=301, product_id=30, change_type="PURCHASE", reference_type="purchase", reference_id=1, quantity_changed=10, previous_quantity=0, new_quantity=10, timestamp=t_log)

    # Sale on Oct 2: 3 units sold (genuine transaction)
    t_sale = datetime(2026, 10, 2, 10, 0, tzinfo=timezone.utc)
    so = SalesOrder(id=301, user_id=1, status="SHIPPED", sale_date=t_sale, total_amount=Decimal("60"))
    it = SalesOrderItem(id=301, sales_order_id=301, product_id=30, quantity=3, unit_price=Decimal("20"), subtotal=Decimal("60"))

    # Stockout on Oct 4: stock dropped to 0
    t_so = datetime(2026, 10, 4, 15, 0, tzinfo=timezone.utc)
    l2 = InventoryLog(id=302, product_id=30, change_type="SALE", reference_type="SALES_ORDER", reference_id=301, quantity_changed=-7, previous_quantity=7, new_quantity=0, timestamp=t_so)

    eval_db.add_all([l1, so, it, l2])
    eval_db.commit()

    # Check span: Sep 30 (pre-log = uncertain), Oct 1 (available, 0 sales), Oct 2 (genuine transaction), Oct 3 (confirmed zero), Oct 4, 5 (stockout)
    cls_res = get_product_demand_classification(eval_db, 30, date(2026, 9, 30), date(2026, 10, 5))

    assert cls_res["total_calendar_days"] == 6
    assert cls_res["uncertain_availability_days"] == 1  # Sep 30
    assert cls_res["genuine_transaction_days"] == 1     # Oct 2
    assert cls_res["stockout_censored_days"] == 2       # Oct 4, Oct 5
    assert cls_res["confirmed_zero_days"] == 2         # Oct 1, Oct 3
    assert cls_res["total_gross_demand"] == 3.0


def test_chronological_baseline_backtest_ineligible(eval_db):
    """An ineligible product returns INSUFFICIENT_OBSERVATIONS without fake benchmark scores."""
    p = Product(id=40, name="IneligibleProd", sku="SKU-40", quantity=5, cost_price=Decimal("5"), selling_price=Decimal("10"), reorder_level=2, category_id=1, supplier_id=1)
    eval_db.add(p)
    eval_db.commit()

    res = run_chronological_baseline_backtest(eval_db, 40, holdout_days=14)

    assert res["status"] == "INSUFFICIENT_OBSERVATIONS"
    assert res["eligible"] is False
    assert len(res["models"]) == 0
    assert len(res["blockers"]) > 0


def test_chronological_baseline_backtest_eligible_series(eval_db):
    """
    Test expanding-window chronological holdout backtest on an eligible product:
    - 60 days of calendar span
    - 20 distinct sale days
    - 14-day holdout
    - Compares Naive-1, Seasonal Naive-7, SMA-28 on identical holdout dates
    - Stockout days masked out of demand error calculations
    """
    p = Product(id=50, name="EligibleProd", sku="SKU-50", quantity=100, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
    eval_db.add(p)
    eval_db.commit()

    start_d = date(2026, 8, 1)

    # Initial inventory log establishing availability
    l_init = InventoryLog(id=501, product_id=50, change_type="PURCHASE", reference_type="purchase", reference_id=1, quantity_changed=100, previous_quantity=0, new_quantity=100, timestamp=datetime(2026, 8, 1, 8, 0, tzinfo=timezone.utc))
    eval_db.add(l_init)

    # Create 60 days of sales history (20 days with sales, cumulative > 20 units)
    for i in range(60):
        cur_d = start_d + timedelta(days=i)
        if i % 3 == 0 or i == 59:  # ensure day 59 is the latest sale date
            qty = 2 + (i % 5)
            so = SalesOrder(id=1000 + i, user_id=1, status="SHIPPED", sale_date=datetime(cur_d.year, cur_d.month, cur_d.day, 10, 0, tzinfo=timezone.utc), total_amount=Decimal(qty * 20))
            it = SalesOrderItem(id=1000 + i, sales_order_id=1000 + i, product_id=50, quantity=qty, unit_price=Decimal("20"), subtotal=Decimal(qty * 20))
            eval_db.add_all([so, it])

    # Add a stockout on the last day of holdout (day 59)
    so_d = start_d + timedelta(days=59)
    l_so = InventoryLog(id=502, product_id=50, change_type="SALE", reference_type="SALES_ORDER", reference_id=1059, quantity_changed=-50, previous_quantity=50, new_quantity=0, timestamp=datetime(so_d.year, so_d.month, so_d.day, 15, 0, tzinfo=timezone.utc))
    eval_db.add(l_so)
    eval_db.commit()

    res = run_chronological_baseline_backtest(eval_db, 50, holdout_days=14, min_pre_holdout_history=28)

    assert res["status"] == "ELIGIBLE_EVALUATED"
    assert res["eligible"] is True
    assert res["holdout_window"]["holdout_days"] == 14
    assert res["holdout_window"]["masked_stockout_dates_count"] == 1
    assert res["holdout_window"]["evaluated_dates_count"] == 13

    # All 3 baseline models evaluated on identical dates
    models = res["models"]
    assert "NAIVE_1" in models
    assert "SEASONAL_NAIVE_7" in models
    assert "SMA_28" in models

    for m_key in ["NAIVE_1", "SEASONAL_NAIVE_7", "SMA_28"]:
        m_info = models[m_key]
        assert len(m_info["predictions"]) == 14
        metrics = m_info["metrics"]
        assert metrics["status"] == "VALID"
        assert metrics["evaluated_observations"] == 13
        assert metrics["masked_stockout_count"] == 1
        assert isinstance(metrics["mae"], float)
        assert isinstance(metrics["rmse"], float)

    assert res["best_baseline_model"] in ["NAIVE_1", "SEASONAL_NAIVE_7", "SMA_28"]


def test_api_readiness_and_backtest_endpoints(eval_engine, eval_db):
    """Verify FastAPI routes for readiness and backtesting under /api/v1/forecast."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.auth.dependencies import get_current_user
    from app.database.database import get_db

    # Ensure a product with id=1 exists in eval_db
    p1 = eval_db.query(Product).filter(Product.id == 1).first()
    if not p1:
        p1 = Product(id=1, name="APIProd1", sku="SKU-API-1", quantity=10, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
        eval_db.add(p1)
        eval_db.commit()

    TestingSessionLocal = sessionmaker(bind=eval_engine)
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    class MockAdminUser:
        id = 1
        username = "testadmin"
        class Role:
            name = "admin"
        role = Role()

    prev_user_override = app.dependency_overrides.get(get_current_user)
    prev_db_override = app.dependency_overrides.get(get_db)

    app.dependency_overrides[get_current_user] = lambda: MockAdminUser()
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # 1. Catalog readiness endpoint
        res_cat = client.get("/api/v1/forecast/readiness")
        assert res_cat.status_code == 200
        cat_data = res_cat.json()
        assert "total_catalog_products" in cat_data
        assert "products" in cat_data

        # 2. Single product readiness endpoint
        res_p1 = client.get("/api/v1/forecast/readiness/1")
        assert res_p1.status_code == 200
        p1_data = res_p1.json()
        assert p1_data["product_id"] == 1
        assert "readiness_status" in p1_data
        assert "blockers" in p1_data

        # 3. Product not found returns 404
        res_404 = client.get("/api/v1/forecast/readiness/99999")
        assert res_404.status_code == 404

        # 4. Backtest endpoint on ineligible product returns INSUFFICIENT_OBSERVATIONS with 200
        res_bt = client.post("/api/v1/forecast/backtest", json={"product_id": 1, "holdout_days": 14})
        assert res_bt.status_code == 200
        bt_data = res_bt.json()
        assert bt_data["product_id"] == 1
        assert bt_data["status"] == "INSUFFICIENT_OBSERVATIONS"
        assert bt_data["eligible"] is False
    finally:
        if prev_user_override is not None:
            app.dependency_overrides[get_current_user] = prev_user_override
        else:
            app.dependency_overrides.pop(get_current_user, None)

        if prev_db_override is not None:
            app.dependency_overrides[get_db] = prev_db_override
        else:
            app.dependency_overrides.pop(get_db, None)


def test_product_12_readiness_audit_consistency(eval_db):
    """
    Task 1: Verify exact aggregation, date boundaries, and density calculation for Product 12 pattern:
    1 fulfilled order of 10 units on a single date (2026-08-02).
    Confirm distinct_sale_dates == 1, calendar_span == 1, observation_density == 100%.
    """
    p12 = Product(id=12, name="Test Product", sku="TEST-001", quantity=50, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
    eval_db.add(p12)

    # 1 sales order of 10 units
    so8 = SalesOrder(id=8, user_id=1, status="SHIPPED", sale_date=datetime(2026, 8, 2, 18, 4, tzinfo=timezone.utc), total_amount=Decimal("200"))
    it8 = SalesOrderItem(id=8, sales_order_id=8, product_id=12, quantity=10, unit_price=Decimal("20"), subtotal=Decimal("200"))
    log12 = InventoryLog(id=120, product_id=12, change_type="PURCHASE", reference_type="purchase", reference_id=1, quantity_changed=60, previous_quantity=0, new_quantity=60, timestamp=datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc))

    eval_db.add_all([so8, it8, log12])
    eval_db.commit()

    readiness = assess_product_backtest_readiness(eval_db, 12)

    obs = readiness["genuine_observations"]
    cal = readiness["calendar_metrics"]

    assert obs["fulfilled_orders"] == 1
    assert obs["distinct_sale_dates"] == 1
    assert obs["total_units_sold"] == 10.0
    assert cal["calendar_span_days"] == 1
    assert cal["imputed_zero_days"] == 0
    assert cal["observation_density"] == 1.0
    assert readiness["is_eligible_for_backtest"] is False
    assert any("Only 1 distinct sale dates" in b for b in readiness["blockers"])


def test_demand_classification_six_semantic_scenarios(eval_db):
    """
    Task 2: Verify all 6 required demand classification cases:
    1. Positive net sales on fulfilled transaction date.
    2. Positive gross sales fully offset by returns (net = 0).
    3. Confirmed zero sales during verified positive stock.
    4. Confirmed stockout days.
    5. Dates with uncertain inventory availability.
    6. Products with no fulfilled transaction history.
    """
    p60 = Product(id=60, name="AuditProduct60", sku="SKU-60", quantity=100, cost_price=Decimal("5"), selling_price=Decimal("10"), reorder_level=2, category_id=1, supplier_id=1)
    eval_db.add(p60)

    # Initial purchase log on Oct 2 establishing stock = 100
    l_init = InventoryLog(id=601, product_id=60, change_type="PURCHASE", reference_type="purchase", reference_id=1, quantity_changed=100, previous_quantity=0, new_quantity=100, timestamp=datetime(2026, 10, 2, 8, 0, tzinfo=timezone.utc))

    # Case 1: Positive net sales on Oct 3 (gross 10, return 2, net 8)
    so_oct3 = SalesOrder(id=601, user_id=1, status="DELIVERED", sale_date=datetime(2026, 10, 3, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("100"))
    it_oct3 = SalesOrderItem(id=601, sales_order_id=601, product_id=60, quantity=10, unit_price=Decimal("10"), subtotal=Decimal("100"))
    sr_oct3 = SalesReturn(id=601, sales_order_id=601, created_by=1, return_date=datetime(2026, 10, 3, 14, 0, tzinfo=timezone.utc), total_refund_amount=Decimal("20"))
    sri_oct3 = SalesReturnItem(id=601, sales_return_id=601, product_id=60, quantity=2, refund_amount=Decimal("20"))

    # Case 2: Gross sales fully offset by returns on Oct 4 (gross 5, return 5, net 0)
    so_oct4 = SalesOrder(id=602, user_id=1, status="COMPLETED", sale_date=datetime(2026, 10, 4, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("50"))
    it_oct4 = SalesOrderItem(id=602, sales_order_id=602, product_id=60, quantity=5, unit_price=Decimal("10"), subtotal=Decimal("50"))
    sr_oct4 = SalesReturn(id=602, sales_order_id=602, created_by=1, return_date=datetime(2026, 10, 4, 15, 0, tzinfo=timezone.utc), total_refund_amount=Decimal("50"))
    sri_oct4 = SalesReturnItem(id=602, sales_return_id=602, product_id=60, quantity=5, refund_amount=Decimal("50"))

    # Case 3: Confirmed zero sales on Oct 5 (positive stock = 100, 0 sales)

    # Case 4: Stockout on Oct 6 (stock drops to 0)
    l_so = InventoryLog(id=602, product_id=60, change_type="SALE", reference_type="SALES_ORDER", reference_id=602, quantity_changed=-100, previous_quantity=100, new_quantity=0, timestamp=datetime(2026, 10, 6, 17, 0, tzinfo=timezone.utc))

    eval_db.add_all([l_init, so_oct3, it_oct3, sr_oct3, sri_oct3, so_oct4, it_oct4, sr_oct4, sri_oct4, l_so])
    eval_db.commit()

    # Query span: Oct 1 (uncertain, pre-log) to Oct 7 (stockout carries forward)
    res = get_product_demand_classification(eval_db, 60, date(2026, 10, 1), date(2026, 10, 7))

    assert res["total_calendar_days"] == 7
    assert res["uncertain_availability_days"] == 1  # Oct 1 (pre-log)
    assert res["genuine_transaction_days"] == 2     # Oct 3, Oct 4
    assert res["genuine_positive_net_days"] == 1     # Oct 3 (net 8)
    assert res["genuine_fully_returned_days"] == 1   # Oct 4 (gross 5, return 5, net 0)
    assert res["confirmed_zero_days"] == 2           # Oct 2, Oct 5 (stock > 0, 0 sales)
    assert res["stockout_censored_days"] == 2        # Oct 6, Oct 7 (stock = 0)

    # Case 6: Product with no fulfilled transaction history
    p70 = Product(id=70, name="ZeroHistory", sku="SKU-70", quantity=0, cost_price=Decimal("1"), selling_price=Decimal("2"), reorder_level=1, category_id=1, supplier_id=1)
    eval_db.add(p70)
    eval_db.commit()

    res_zero = get_product_demand_classification(eval_db, 70, date(2026, 10, 1), date(2026, 10, 5))
    assert res_zero["genuine_transaction_days"] == 0
    assert res_zero["total_gross_demand"] == 0.0
    assert res_zero["uncertain_availability_days"] == 5  # No logs exist -> all uncertain


def test_metric_boundaries_and_invalid_inputs():
    """
    Task 4: Audit metric edge cases, boundary conditions, input validation, and bias convention.
    """
    # 1. Empty evaluation set
    res_empty = calculate_forecast_metrics([], [])
    assert res_empty["status"] == "NO_VALID_OBSERVATIONS"
    assert res_empty["wape_diagnostic"] == "EMPTY_EVALUATION_SET"
    assert res_empty["mae"] is None

    # 2. Length mismatch
    with pytest.raises(ValueError, match="Length mismatch"):
        calculate_forecast_metrics([1.0, 2.0], [1.0])

    # 3. Non-finite inputs (NaN / Inf)
    with pytest.raises(ValueError, match="non-finite values"):
        calculate_forecast_metrics([1.0, np.nan], [1.0, 2.0])

    with pytest.raises(ValueError, match="non-finite values"):
        calculate_forecast_metrics([1.0, 2.0], [np.inf, 2.0])

    # 4. Negative values
    with pytest.raises(ValueError, match="negative demand values"):
        calculate_forecast_metrics([-1.0, 2.0], [1.0, 2.0])

    with pytest.raises(ValueError, match="negative values"):
        calculate_forecast_metrics([1.0, 2.0], [-0.5, 2.0])

    # 5. All masked days
    res_all_masked = calculate_forecast_metrics([10.0, 20.0], [12.0, 18.0], stockout_mask=[True, True])
    assert res_all_masked["status"] == "NO_VALID_OBSERVATIONS"
    assert res_all_masked["wape_diagnostic"] == "ALL_OBSERVATIONS_MASKED"
    assert res_all_masked["evaluated_observations"] == 0

    # 6. Zero total demand (WAPE 0/0)
    res_zero_dem = calculate_forecast_metrics([0.0, 0.0], [1.0, 2.0])
    assert res_zero_dem["status"] == "VALID"
    assert res_zero_dem["wape"] is None
    assert res_zero_dem["wape_diagnostic"] == "UNDEFINED_ZERO_DEMAND_DENOMINATOR"

    # 7. Low-volume WAPE warning (< 10 total actual units)
    res_low_vol = calculate_forecast_metrics([2.0, 3.0], [2.0, 4.0])
    assert res_low_vol["status"] == "VALID"
    assert res_low_vol["wape_diagnostic"] == "LOW_VOLUME_VOLATILITY"

    # 8. Bias sign convention: mean(y_hat - y)
    # Over-forecasting (y_hat = 15, y = 10) -> bias = +5.0
    res_over = calculate_forecast_metrics([10.0], [15.0])
    assert res_over["bias"] == 5.0

    # Under-forecasting (y_hat = 8, y = 10) -> bias = -2.0
    res_under = calculate_forecast_metrics([10.0], [8.0])
    assert res_under["bias"] == -2.0


def test_chronological_backtest_all_masked_diagnostics(eval_db):
    """
    Task 3: If all holdout days are masked (due to stockout or uncertain availability),
    must return diagnostic status NO_EVALUATION_OBSERVATIONS rather than fabricated metrics.
    """
    p80 = Product(id=80, name="AllStockoutHoldout", sku="SKU-80", quantity=100, cost_price=Decimal("10"), selling_price=Decimal("20"), reorder_level=5, category_id=1, supplier_id=1)
    eval_db.add(p80)

    # Initial log on Aug 1
    l_init = InventoryLog(id=801, product_id=80, change_type="PURCHASE", reference_type="purchase", reference_id=1, quantity_changed=100, previous_quantity=0, new_quantity=100, timestamp=datetime(2026, 8, 1, 8, 0, tzinfo=timezone.utc))
    eval_db.add(l_init)

    start_d = date(2026, 8, 1)

    # 60 days of sales history
    for i in range(60):
        cur_d = start_d + timedelta(days=i)
        if i % 3 == 0 or i == 59:
            so = SalesOrder(id=2000 + i, user_id=1, status="SHIPPED", sale_date=datetime(cur_d.year, cur_d.month, cur_d.day, 10, 0, tzinfo=timezone.utc), total_amount=Decimal("40"))
            it = SalesOrderItem(id=2000 + i, sales_order_id=2000 + i, product_id=80, quantity=2, unit_price=Decimal("20"), subtotal=Decimal("40"))
            eval_db.add_all([so, it])

    # Stockout occurring on day 46 (at cutoff of 14-day holdout) making the entire holdout stocked out
    so_date = start_d + timedelta(days=46)
    l_so = InventoryLog(id=802, product_id=80, change_type="SALE", reference_type="SALES_ORDER", reference_id=2046, quantity_changed=-100, previous_quantity=100, new_quantity=0, timestamp=datetime(so_date.year, so_date.month, so_date.day, 8, 0, tzinfo=timezone.utc))
    eval_db.add(l_so)
    eval_db.commit()

    res = run_chronological_baseline_backtest(eval_db, 80, holdout_days=14, min_pre_holdout_history=28)

    assert res["status"] == "NO_EVALUATION_OBSERVATIONS"
    assert res["best_baseline_model"] == "NONE"
    assert res["holdout_window"]["evaluated_dates_count"] == 0
    assert res["holdout_window"]["masked_stockout_dates_count"] == 14


def test_api_validation_and_unauthorized(eval_engine, eval_db):
    """
    Task 5: Verify input validation (422) on invalid parameters and 401 on unauthorized access.
    """
    from fastapi.testclient import TestClient
    from app.main import app
    from app.auth.dependencies import get_current_user
    from app.database.database import get_db

    TestingSessionLocal = sessionmaker(bind=eval_engine)
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    class MockUser:
        id = 1
        username = "regular_user"
        class Role:
            name = "staff"
        role = Role()

    prev_user_override = app.dependency_overrides.get(get_current_user)
    prev_db_override = app.dependency_overrides.get(get_db)

    app.dependency_overrides[get_current_user] = lambda: MockUser()
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # Invalid product_id <= 0 on readiness endpoint returns 422
        res_neg = client.get("/api/v1/forecast/readiness/-1")
        assert res_neg.status_code == 422

        res_zero = client.get("/api/v1/forecast/readiness/0")
        assert res_zero.status_code == 422

        # Invalid holdout_days on backtest endpoint (< 7) returns 422
        res_h_small = client.post("/api/v1/forecast/backtest", json={"product_id": 1, "holdout_days": 2})
        assert res_h_small.status_code == 422

        # Invalid min_pre_holdout_history (< 28) returns 422
        res_pre_small = client.post("/api/v1/forecast/backtest", json={"product_id": 1, "holdout_days": 14, "min_pre_holdout_history": 10})
        assert res_pre_small.status_code == 422

        # Invalid product_id <= 0 in POST body returns 422
        res_bt_neg = client.post("/api/v1/forecast/backtest", json={"product_id": -5, "holdout_days": 14})
        assert res_bt_neg.status_code == 422

        # Test unauthorized: clear user override and ensure 401
        app.dependency_overrides.pop(get_current_user, None)
        res_unauth = client.get("/api/v1/forecast/readiness")
        assert res_unauth.status_code == 401
    finally:
        if prev_user_override is not None:
            app.dependency_overrides[get_current_user] = prev_user_override
        else:
            app.dependency_overrides.pop(get_current_user, None)

        if prev_db_override is not None:
            app.dependency_overrides[get_db] = prev_db_override
        else:
            app.dependency_overrides.pop(get_db, None)

