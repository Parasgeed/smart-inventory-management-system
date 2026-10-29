"""
Forecast business logic service.
Orchestrates continuous sales history retrieval, zero-demand imputation,
cold-start routing, and recursive multi-day forecasting.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from decimal import Decimal

import numpy as np
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

# Ensure ML package is available on path
_ML_SRC = Path(__file__).resolve().parents[3] / "Machine learning" / "src"
if str(_ML_SRC) not in sys.path:
    sys.path.insert(0, str(_ML_SRC))

from predictor import (
    compute_step_features,
    predict_step,
    compute_step_features_v3,
    predict_step_v3,
)
from app.models.product_model import Product
from app.models.category_model import Category
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.services.sales_history_service import SalesHistoryService


class ContinuousHistoryResult(tuple):
    """
    Subclass of tuple returning (history_series, history_cutoff_date, forecast_start_date)
    while exposing .stockout_days attribute for seamless backward compatibility.
    """
    def __new__(cls, history_series, history_cutoff_date, forecast_start_date, stockout_days=0):
        return super().__new__(cls, (history_series, history_cutoff_date, forecast_start_date))

    def __init__(self, history_series, history_cutoff_date, forecast_start_date, stockout_days=0):
        self.history_series = history_series
        self.history_cutoff_date = history_cutoff_date
        self.forecast_start_date = forecast_start_date
        self.stockout_days = stockout_days


def get_continuous_sales_history(
    db: Session,
    product_id: int,
    max_days: int = 120,
) -> ContinuousHistoryResult:
    """
    Extracts sales transactions using SalesHistoryService, aggregates per day up to yesterday (closed day),
    reindexes over continuous calendar dates, and detects historical stockouts.
    Returns (history_series, history_cutoff_date, forecast_start_date) with .stockout_days.
    """
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_date = today - timedelta(days=max_days)

    df = SalesHistoryService.get_product_daily_demand(
        db=db,
        product_id=product_id,
        start_date=start_date,
        end_date=yesterday,
        demand_type="gross",
    )

    # Check if any fulfilled sales records exist across the lookback period
    active_mask = (df["order_count"] > 0) | (df["gross_demand"] > 0)
    if not active_mask.any():
        return ContinuousHistoryResult(pd.Series(dtype=float), yesterday, today, 0)

    # Locate earliest sale date to anchor the series
    sales_dates = df[active_mask].index
    first_date = sales_dates.min().date()

    active_df = df.loc[pd.Timestamp(first_date):pd.Timestamp(yesterday)]
    history_series = pd.Series(
        active_df["units"].values,
        index=active_df.index,
        dtype=float,
    )
    stockout_days_count = int(active_df["is_stockout"].sum())

    return ContinuousHistoryResult(history_series, yesterday, today, stockout_days_count)


def generate_forecast(
    db: Session,
    product_id: int,
    horizon_days: int = 7,
    holiday_flag: int = 0,
    discount_pct: float = 0.0,
    model_preference: str = "BASELINE_SMA28",
) -> dict:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product with ID {product_id} not found")

    category_name = product.category.name if product.category else "Uncategorized"
    selling_price = float(product.selling_price) if product.selling_price is not None else 0.0

    history_result = get_continuous_sales_history(db, product_id, max_days=120)
    history_series, history_cutoff, forecast_start = history_result
    stockout_days = getattr(history_result, "stockout_days", 0)
    history_days = len(history_series)

    warnings: list[str] = [
        "Days without recorded sales are imputed as zero demand. This may underestimate true demand if stockouts occurred."
    ]
    if stockout_days > 0:
        warnings.append(
            f"Product experienced {stockout_days} historical stockout day(s) during the lookback window. Zero recorded sales during stockouts reflect inventory unavailability rather than lack of customer demand."
        )

    forecasts: list[dict] = []

    # Tier 1: Zero history
    if history_days == 0:
        urgency = "CRITICAL" if product.quantity < product.reorder_level else "ADEQUATE"
        recommended_qty = max(0, product.reorder_level - product.quantity)
        warnings.append("Product has 0 days of sales history. At least 28 continuous days required for full baseline SMA-28.")
        return {
            "product_id": product.id,
            "product_name": product.name,
            "status": "INSUFFICIENT_HISTORY",
            "model_status": "NONE",
            "forecast_method": "NONE",
            "forecast_generated_at": datetime.now(timezone.utc).isoformat(),
            "history_cutoff_date": history_cutoff,
            "forecast_start_date": forecast_start,
            "history_days_available": 0,
            "history_days_required": 28,
            "horizon_days": horizon_days,
            "forecasts": [],
            "restock_recommendation": {
                "current_stock": product.quantity,
                "days_of_stock_remaining": None,
                "recommended_reorder_qty": recommended_qty,
                "reorder_urgency": urgency,
            },
            "stockout_days_detected": stockout_days,
            "warnings": warnings,
        }

    # Tier 2: Partial history (1-27 days) -> Simple Moving Average fallback
    if history_days < 28:
        avg_units = max(0.0, round(float(history_series.mean()), 2))
        for i in range(horizon_days):
            target_date = forecast_start + timedelta(days=i)
            forecasts.append({
                "date": target_date,
                "predicted_units": avg_units,
            })
        status = "PARTIAL_HISTORY"
        model_status = "BASELINE_HEURISTIC"
        forecast_method = "FALLBACK_MOVING_AVERAGE"
        warnings.append(
            f"Product has only {history_days} days of history (28 required). Used baseline moving average fallback."
        )

    # Tier 3: Full history (>= 28 days) -> Model Routing
    else:
        # Route A: CatBoost V3 Causal Experimental (isolated research simulation)
        if model_preference == "CATBOOST_V3_EXPERIMENTAL":
            status = "EXPERIMENTAL_SUCCESS"
            model_status = "EXPERIMENTAL_UNVALIDATED"
            forecast_method = "CATBOOST_V3_EXPERIMENTAL"
            warnings.append(
                "EXPERIMENTAL FORECAST (CatBoost V3): Model was evaluated via 5-fold walk-forward cross-validation "
                "(MAE 89.32 vs SMA-28 MAE 89.84, with no statistically significant advantage). Trained on synthetic "
                "benchmark data with near-zero temporal autocorrelation. Outputs are exploratory simulation heuristics "
                "and must not be used for automated purchase decisions."
            )
            if discount_pct > 0 or holiday_flag == 1:
                warnings.append(
                    "SCENARIO SIMULATION NOTICE: The training data lacks verified real-world retail price elasticity. "
                    "Scenario demand adjustments are observational heuristics and do not establish causal effects."
                )

            current_history = history_series.copy()
            for i in range(horizon_days):
                target_date = forecast_start + timedelta(days=i)
                target_ts = pd.Timestamp(target_date)

                feature_df = compute_step_features_v3(
                    target_date=target_ts,
                    history_series=current_history,
                    category_name=category_name,
                    price=selling_price,
                    discount_pct=discount_pct,
                    holiday_flag=holiday_flag,
                )

                predicted_units = round(predict_step_v3(feature_df), 2)
                forecasts.append({
                    "date": target_date,
                    "predicted_units": predicted_units,
                })
                current_history[target_ts] = predicted_units

        # Route B: CatBoost V2 Legacy Experimental (audit and rollback verification)
        elif model_preference == "CATBOOST_V2_EXPERIMENTAL":
            status = "EXPERIMENTAL_SUCCESS"
            model_status = "EXPERIMENTAL_UNVALIDATED"
            forecast_method = "CATBOOST_V2_EXPERIMENTAL"
            warnings.append(
                "LEGACY EXPERIMENTAL AUDIT (CatBoost V2): Model features contain known target leakage "
                "(Demand_Change_1 = Units Sold.diff(1)). Retained strictly for audit and rollback verification."
            )

            current_history = history_series.copy()
            product_id_str = f"PROD_{product.id}"

            for i in range(horizon_days):
                target_date = forecast_start + timedelta(days=i)
                target_ts = pd.Timestamp(target_date)

                feature_df = compute_step_features(
                    target_date=target_ts,
                    history_series=current_history,
                    product_id_str=product_id_str,
                    category_name=category_name,
                    price=selling_price,
                    discount_pct=discount_pct,
                    holiday_flag=holiday_flag,
                )

                predicted_units = round(predict_step(feature_df), 2)
                forecasts.append({
                    "date": target_date,
                    "predicted_units": predicted_units,
                })
                current_history[target_ts] = predicted_units

        # Route C: Default Transparent SMA-28 Baseline (recommended production path)
        else:
            status = "SUCCESS"
            model_status = "BASELINE_HEURISTIC"
            forecast_method = "SMA_28_BASELINE"
            sma_28 = max(0.0, round(float(history_series.iloc[-28:].mean()), 2))

            for i in range(horizon_days):
                target_date = forecast_start + timedelta(days=i)
                forecasts.append({
                    "date": target_date,
                    "predicted_units": sma_28,
                })

            warnings.append(
                "Transparent baseline forecast generated using 28-day simple moving average (SMA-28). "
                "Days without sales were imputed as zero demand."
            )

    # Advisory Restocking Recommendation (purely informative, non-mutating)
    total_predicted = sum(f["predicted_units"] for f in forecasts)
    avg_daily_demand = total_predicted / horizon_days if horizon_days > 0 else 0.0

    days_remaining = round(product.quantity / avg_daily_demand, 1) if avg_daily_demand > 0 else None

    if days_remaining is None:
        urgency = "CRITICAL" if product.quantity < product.reorder_level else "ADEQUATE"
    elif days_remaining <= 3:
        urgency = "CRITICAL"
    elif days_remaining < horizon_days:
        urgency = "LOW"
    else:
        urgency = "ADEQUATE"

    recommended_reorder_qty = max(0, int(total_predicted) - product.quantity + product.reorder_level)

    return {
        "product_id": product.id,
        "product_name": product.name,
        "status": status,
        "model_status": model_status,
        "forecast_method": forecast_method,
        "forecast_generated_at": datetime.now(timezone.utc).isoformat(),
        "history_cutoff_date": history_cutoff,
        "forecast_start_date": forecast_start,
        "history_days_available": history_days,
        "history_days_required": 28,
        "horizon_days": horizon_days,
        "forecasts": forecasts,
        "restock_recommendation": {
            "current_stock": product.quantity,
            "days_of_stock_remaining": days_remaining,
            "recommended_reorder_qty": recommended_reorder_qty,
            "reorder_urgency": urgency,
        },
        "stockout_days_detected": stockout_days,
        "warnings": warnings,
    }
