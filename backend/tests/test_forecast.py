import sys
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

# Ensure ML package is on path
_ML_SRC = Path(__file__).resolve().parents[2] / "Machine learning" / "src"
if str(_ML_SRC) not in sys.path:
    sys.path.insert(0, str(_ML_SRC))

from predictor import compute_step_features, predict_step, load_model
from app.main import app
from app.database.database import get_db
from app.auth.dependencies import get_current_user
from app.services.forecast_service import (
    get_continuous_sales_history,
    generate_forecast,
)

# Mock authenticated user
class MockUser:
    id = 1
    class Role:
        name = "admin"
    role = Role()


def override_get_current_user():
    return MockUser()


# ---------------------------------------------------------------------------
# Unit Tests: Predictor & Feature Engineering
# ---------------------------------------------------------------------------

def test_unseen_product_identifier_prediction():
    """Verify CatBoost accepts unseen product IDs (e.g. PROD_9999) without failure."""
    today = pd.Timestamp("2026-10-19")
    dates = pd.date_range(end=today - pd.Timedelta(days=1), periods=30, freq="D")
    history = pd.Series(np.random.uniform(5, 20, size=30), index=dates)

    features_df = compute_step_features(
        target_date=today,
        history_series=history,
        product_id_str="PROD_9999",
        category_name="Groceries",
        price=29.99,
        discount_pct=5.0,
        holiday_flag=0,
    )

    assert len(features_df) == 1
    assert features_df["Product ID"].iloc[0] == "PROD_9999"
    assert features_df.shape[1] == 40

    prediction = predict_step(features_df)
    assert isinstance(prediction, float)
    assert prediction >= 0.0


def test_insufficient_history_raises_in_predictor():
    """Verify compute_step_features raises ValueError if history < 28 days."""
    today = pd.Timestamp("2026-10-19")
    dates = pd.date_range(end=today - pd.Timedelta(days=1), periods=15, freq="D")
    history = pd.Series(np.ones(15), index=dates)

    with pytest.raises(ValueError, match="Need >= 28 continuous days"):
        compute_step_features(
            target_date=today,
            history_series=history,
            product_id_str="PROD_1",
            category_name="Electronics",
            price=99.0,
        )


# ---------------------------------------------------------------------------
# Service Tests: Calendar Alignment & Cold-Start Logic
# ---------------------------------------------------------------------------

def test_continuous_calendar_reindexing_and_zero_fill():
    """Verify missing sales transaction days are imputed as 0.0."""
    mock_db = MagicMock()

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    d1 = yesterday - timedelta(days=6)
    d4 = yesterday - timedelta(days=3)
    d7 = yesterday

    # Only 3 sales records across a 7-day period
    mock_row1 = MagicMock()
    mock_row1.sale_date = d1
    mock_row1.total_units = 10

    mock_row2 = MagicMock()
    mock_row2.sale_date = d4
    mock_row2.total_units = 5

    mock_row3 = MagicMock()
    mock_row3.sale_date = d7
    mock_row3.total_units = 8

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = [mock_row1, mock_row2, mock_row3]

    history, cutoff, start = get_continuous_sales_history(mock_db, product_id=1)

    assert cutoff == yesterday
    assert start == today
    assert len(history) == 7
    # d1, d4, d7 have values; others must be 0.0
    assert history.iloc[0] == 10.0
    assert history.iloc[1] == 0.0
    assert history.iloc[2] == 0.0
    assert history.iloc[3] == 5.0
    assert history.iloc[4] == 0.0
    assert history.iloc[5] == 0.0
    assert history.iloc[6] == 8.0


def test_cold_start_tier1_zero_history():
    """Verify Tier 1 cold-start returns INSUFFICIENT_HISTORY and advisory reorder."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 101
    mock_product.name = "Brand New Item"
    mock_product.quantity = 2
    mock_product.reorder_level = 10
    mock_product.selling_price = Decimal("25.00")
    mock_product.category = None

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    # Empty sales history
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = []

    result = generate_forecast(mock_db, product_id=101, horizon_days=7)

    assert result["status"] == "INSUFFICIENT_HISTORY"
    assert result["model_status"] == "NONE"
    assert result["forecast_method"] == "NONE"
    assert result["forecasts"] == []
    assert result["history_days_available"] == 0
    assert result["restock_recommendation"]["recommended_reorder_qty"] == 8
    assert result["restock_recommendation"]["reorder_urgency"] == "CRITICAL"


def test_cold_start_tier2_partial_history():
    """Verify Tier 2 returns PARTIAL_HISTORY with Simple Moving Average fallback."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 102
    mock_product.name = "Recent Item"
    mock_product.quantity = 20
    mock_product.reorder_level = 5
    mock_product.selling_price = Decimal("15.00")
    mock_product.category = None

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_10 = yesterday - timedelta(days=9)

    # 10 days of continuous 4.0 units/day
    mock_rows = []
    for i in range(10):
        r = MagicMock()
        r.sale_date = start_10 + timedelta(days=i)
        r.total_units = 4
        mock_rows.append(r)

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    result = generate_forecast(mock_db, product_id=102, horizon_days=5)

    assert result["status"] == "PARTIAL_HISTORY"
    assert result["model_status"] == "BASELINE_HEURISTIC"
    assert result["forecast_method"] == "FALLBACK_MOVING_AVERAGE"
    assert len(result["forecasts"]) == 5
    assert result["forecasts"][0]["predicted_units"] == 4.0
    assert result["history_days_available"] == 10
    assert any("baseline moving average fallback" in w for w in result["warnings"])


def test_tier3_default_sma28_baseline_forecasting():
    """Verify Tier 3 with default model_preference uses transparent SMA-28 baseline."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 103
    mock_product.name = "Mature Item"
    mock_product.quantity = 50
    mock_product.reorder_level = 10
    mock_product.selling_price = Decimal("50.00")
    mock_category = MagicMock()
    mock_category.name = "Groceries"
    mock_product.category = mock_category

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_35 = yesterday - timedelta(days=34)

    mock_rows = []
    for i in range(35):
        r = MagicMock()
        r.sale_date = start_35 + timedelta(days=i)
        r.total_units = 10.0
        mock_rows.append(r)

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    result = generate_forecast(mock_db, product_id=103, horizon_days=7)

    assert result["status"] == "SUCCESS"
    assert result["model_status"] == "BASELINE_HEURISTIC"
    assert result["forecast_method"] == "SMA_28_BASELINE"
    assert len(result["forecasts"]) == 7
    assert result["history_days_available"] == 35
    for f in result["forecasts"]:
        assert f["predicted_units"] == 10.0
    assert any("SMA-28" in w for w in result["warnings"])


def test_tier3_catboost_v3_experimental_forecasting():
    """Verify Tier 3 with model_preference='CATBOOST_V3_EXPERIMENTAL' executes clean causal V3."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 104
    mock_product.name = "Simulated Item"
    mock_product.quantity = 25
    mock_product.reorder_level = 5
    mock_product.selling_price = Decimal("35.00")
    mock_category = MagicMock()
    mock_category.name = "Electronics"
    mock_product.category = mock_category

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_30 = yesterday - timedelta(days=29)

    mock_rows = []
    for i in range(30):
        r = MagicMock()
        r.sale_date = start_30 + timedelta(days=i)
        r.total_units = 12 + (i % 3)
        mock_rows.append(r)

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    result = generate_forecast(
        mock_db,
        product_id=104,
        horizon_days=7,
        discount_pct=10.0,
        holiday_flag=1,
        model_preference="CATBOOST_V3_EXPERIMENTAL",
    )

    assert result["status"] == "EXPERIMENTAL_SUCCESS"
    assert result["model_status"] == "EXPERIMENTAL_UNVALIDATED"
    assert result["forecast_method"] == "CATBOOST_V3_EXPERIMENTAL"
    assert len(result["forecasts"]) == 7
    for f in result["forecasts"]:
        assert isinstance(f["predicted_units"], float)
        assert f["predicted_units"] >= 0.0
    assert any("CatBoost V3" in w for w in result["warnings"])
    assert any("SCENARIO SIMULATION NOTICE" in w for w in result["warnings"])


def test_tier3_catboost_v2_legacy_audit_forecasting():
    """Verify legacy V2 model is retained for audit and rollback."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 105
    mock_product.name = "Legacy Item"
    mock_product.quantity = 50
    mock_product.reorder_level = 10
    mock_product.selling_price = Decimal("50.00")
    mock_category = MagicMock()
    mock_category.name = "Groceries"
    mock_product.category = mock_category

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_35 = yesterday - timedelta(days=34)

    mock_rows = []
    for i in range(35):
        r = MagicMock()
        r.sale_date = start_35 + timedelta(days=i)
        r.total_units = 10 + (i % 5)
        mock_rows.append(r)

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    result = generate_forecast(
        mock_db,
        product_id=105,
        horizon_days=7,
        model_preference="CATBOOST_V2_EXPERIMENTAL",
    )

    assert result["status"] == "EXPERIMENTAL_SUCCESS"
    assert result["model_status"] == "EXPERIMENTAL_UNVALIDATED"
    assert result["forecast_method"] == "CATBOOST_V2_EXPERIMENTAL"
    assert len(result["forecasts"]) == 7
    assert any("LEGACY EXPERIMENTAL AUDIT" in w for w in result["warnings"])


def test_unseen_category_and_zero_sales_history():
    """Verify unseen category and 30 days of zero sales do not cause errors."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 106
    mock_product.name = "Novel Item"
    mock_product.quantity = 0
    mock_product.reorder_level = 15
    mock_product.selling_price = Decimal("99.99")
    mock_category = MagicMock()
    mock_category.name = "Novel Unseen Category XYZ"
    mock_product.category = mock_category

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_30 = yesterday - timedelta(days=29)

    # 30 days of zero sales
    mock_rows = []
    for i in range(30):
        r = MagicMock()
        r.sale_date = start_30 + timedelta(days=i)
        r.total_units = 0.0
        mock_rows.append(r)

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    # Test baseline
    res_base = generate_forecast(mock_db, product_id=106, horizon_days=7)
    assert res_base["forecast_method"] == "SMA_28_BASELINE"
    for f in res_base["forecasts"]:
        assert f["predicted_units"] == 0.0
    assert res_base["restock_recommendation"]["reorder_urgency"] == "CRITICAL"

    # Test V3 experimental with unseen category
    res_v3 = generate_forecast(
        mock_db,
        product_id=106,
        horizon_days=7,
        model_preference="CATBOOST_V3_EXPERIMENTAL",
    )
    assert res_v3["forecast_method"] == "CATBOOST_V3_EXPERIMENTAL"
    assert len(res_v3["forecasts"]) == 7
    for f in res_v3["forecasts"]:
        assert np.isfinite(f["predicted_units"])
        assert f["predicted_units"] >= 0.0


def test_no_database_mutations_or_automatic_orders():
    """Verify forecasting is strictly read-only and never performs database mutations."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 107
    mock_product.name = "Read Only Item"
    mock_product.quantity = 1
    mock_product.reorder_level = 20
    mock_product.selling_price = Decimal("10.00")
    mock_product.category = None

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_30 = yesterday - timedelta(days=29)

    mock_rows = [MagicMock(sale_date=start_30 + timedelta(days=i), total_units=5.0) for i in range(30)]

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    generate_forecast(mock_db, product_id=107, horizon_days=14)

    # Assert no mutation methods were called on the db session
    assert mock_db.add.call_count == 0
    assert mock_db.add_all.call_count == 0
    assert mock_db.delete.call_count == 0
    assert mock_db.commit.call_count == 0


# ---------------------------------------------------------------------------
# API Route Tests (FastAPI TestClient)
# ---------------------------------------------------------------------------

def test_api_forecast_demand_endpoint_default_baseline():
    """Test successful 200 response from /api/v1/forecast/demand endpoint with default SMA-28 baseline."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 1
    mock_product.name = "Test Item"
    mock_product.quantity = 15
    mock_product.reorder_level = 5
    mock_product.selling_price = Decimal("20.00")
    mock_product.category = None

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_30 = yesterday - timedelta(days=29)

    mock_rows = []
    for i in range(30):
        r = MagicMock()
        r.sale_date = start_30 + timedelta(days=i)
        r.total_units = 8.0
        mock_rows.append(r)

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    response = client.post(
        "/api/v1/forecast/demand",
        json={
            "product_id": 1,
            "horizon_days": 7,
            "holiday_flag": 0,
            "discount_pct": 0.0,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["product_id"] == 1
    assert data["status"] == "SUCCESS"
    assert data["model_status"] == "BASELINE_HEURISTIC"
    assert data["forecast_method"] == "SMA_28_BASELINE"
    assert len(data["forecasts"]) == 7
    assert data["forecasts"][0]["predicted_units"] == 8.0
    assert "restock_recommendation" in data


def test_api_forecast_catboost_v3_experimental():
    """Test explicit request for isolated CatBoost V3 experimental simulation."""
    mock_db = MagicMock()

    mock_product = MagicMock()
    mock_product.id = 1
    mock_product.name = "Test Item"
    mock_product.quantity = 15
    mock_product.reorder_level = 5
    mock_product.selling_price = Decimal("20.00")
    mock_product.category = None

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_30 = yesterday - timedelta(days=29)

    mock_rows = [MagicMock(sale_date=start_30 + timedelta(days=i), total_units=8.0) for i in range(30)]

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = mock_product
    mock_query.join.return_value = mock_query
    mock_query.group_by.return_value = mock_query
    mock_query.all.return_value = mock_rows

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    response = client.post(
        "/api/v1/forecast/demand",
        json={
            "product_id": 1,
            "horizon_days": 7,
            "model_preference": "CATBOOST_V3_EXPERIMENTAL",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "EXPERIMENTAL_SUCCESS"
    assert data["model_status"] == "EXPERIMENTAL_UNVALIDATED"
    assert data["forecast_method"] == "CATBOOST_V3_EXPERIMENTAL"
    assert len(data["forecasts"]) == 7


def test_api_forecast_product_not_found():
    """Test 404 response when product does not exist."""
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = None

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app)

    response = client.post(
        "/api/v1/forecast/demand",
        json={"product_id": 99999, "horizon_days": 7},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_api_forecast_validation_error():
    """Test 422 response when horizon_days > 90."""
    app.dependency_overrides[get_current_user] = override_get_current_user
    client = TestClient(app)

    response = client.post(
        "/api/v1/forecast/demand",
        json={"product_id": 1, "horizon_days": 100},
    )
    assert response.status_code == 422


def test_api_forecast_unauthorized():
    """Test 401 response when request is unauthenticated."""
    old_override = app.dependency_overrides.pop(get_current_user, None)
    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/forecast/demand",
            json={"product_id": 1, "horizon_days": 7},
        )
        assert response.status_code == 401
    finally:
        if old_override is not None:
            app.dependency_overrides[get_current_user] = old_override

