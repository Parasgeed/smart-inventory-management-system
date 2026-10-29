"""
Forecast Evaluation and Real-Data Readiness Service.
Provides reproducible evaluation protocols, error metrics with boundary-condition guards,
stockout-censoring masking, and dataset readiness gating for real retail transactions.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Optional, Sequence

import numpy as np
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.product_model import Product
from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.inventory_log_model import InventoryLog
from app.services.sales_history_service import (
    SalesHistoryService,
    FULFILLED_ORDER_STATUSES,
    _to_date,
)

DEFAULT_READINESS_THRESHOLDS = {
    "min_active_days": 14,
    "min_calendar_days": 56,
    "min_units": 20,
    "min_density": 0.20,
    "min_pre_holdout_history": 28,
}


def calculate_forecast_metrics(
    actuals: Sequence[float] | np.ndarray,
    predictions: Sequence[float] | np.ndarray,
    stockout_mask: Sequence[bool] | np.ndarray | None = None,
) -> dict[str, Any]:
    """
    Computes standard inventory demand forecasting metrics with boundary condition guards:
    - MAE: Mean Absolute Error (in physical units)
    - RMSE: Root Mean Squared Error (penalizes large swings)
    - WAPE: Weighted Absolute Percentage Error (sum(|y - y_hat|) / sum(y))
    - Bias: Mean Directional Bias (mean(y_hat - y); positive = over-forecast, negative = under-forecast)
    - Sample Count: Total, evaluated, and masked observation counts.

    Stockout Censoring Policy:
    When stockout_mask[t] is True, that day's physical stock was 0. Observed sales (0)
    reflects stock unavailability rather than genuine zero customer demand.
    Those days are masked out of the evaluation sample to avoid penalizing models
    for anticipating demand during stockouts.

    WAPE Boundary Conditions:
    - If sum(actuals) == 0.0, WAPE is undefined (0/0). Returns None with diagnostic flag.
    - If sum(actuals) < 10.0, WAPE can be misleadingly volatile. Flag LOW_VOLUME_VOLATILITY is set.
    """
    y = np.asarray(actuals, dtype=float)
    y_hat = np.asarray(predictions, dtype=float)

    if len(y) != len(y_hat):
        raise ValueError(f"Length mismatch: actuals ({len(y)}) vs predictions ({len(y_hat)})")

    if not np.all(np.isfinite(y)):
        raise ValueError("Actuals contain non-finite values (NaN or Inf)")
    if not np.all(np.isfinite(y_hat)):
        raise ValueError("Predictions contain non-finite values (NaN or Inf)")

    if np.any(y < 0.0):
        raise ValueError("Actuals cannot contain negative demand values")
    if np.any(y_hat < 0.0):
        raise ValueError("Predictions cannot contain negative values")

    total_observations = len(y)

    if total_observations == 0:
        return {
            "status": "NO_VALID_OBSERVATIONS",
            "total_observations": 0,
            "evaluated_observations": 0,
            "masked_stockout_count": 0,
            "mae": None,
            "rmse": None,
            "wape": None,
            "wape_diagnostic": "EMPTY_EVALUATION_SET",
            "bias": None,
            "total_actual_demand": 0.0,
            "total_predicted_demand": 0.0,
        }

    # Apply stockout censoring mask if provided
    if stockout_mask is not None:
        so_mask = np.asarray(stockout_mask, dtype=bool)
        if len(so_mask) != total_observations:
            raise ValueError(f"stockout_mask length ({len(so_mask)}) must match actuals ({total_observations})")
        valid_indices = ~so_mask
        masked_stockout_count = int(np.sum(so_mask))
    else:
        valid_indices = np.ones(total_observations, dtype=bool)
        masked_stockout_count = 0

    y_eval = y[valid_indices]
    y_hat_eval = y_hat[valid_indices]
    evaluated_count = len(y_eval)

    if evaluated_count == 0:
        return {
            "status": "NO_VALID_OBSERVATIONS",
            "total_observations": total_observations,
            "evaluated_observations": 0,
            "masked_stockout_count": masked_stockout_count,
            "mae": None,
            "rmse": None,
            "wape": None,
            "wape_diagnostic": "ALL_OBSERVATIONS_MASKED",
            "bias": None,
            "total_actual_demand": 0.0,
            "total_predicted_demand": 0.0,
        }

    errors = y_hat_eval - y_eval
    abs_errors = np.abs(errors)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    bias = float(np.mean(errors))

    sum_actual = float(np.sum(y_eval))
    sum_predicted = float(np.sum(y_hat_eval))
    sum_abs_errors = float(np.sum(abs_errors))

    if math.isclose(sum_actual, 0.0, abs_tol=1e-8):
        wape = None
        wape_diagnostic = "UNDEFINED_ZERO_DEMAND_DENOMINATOR"
    else:
        wape = round(float(sum_abs_errors / sum_actual), 4)
        wape_diagnostic = "LOW_VOLUME_VOLATILITY" if sum_actual < 10.0 else "VALID"

    return {
        "status": "VALID",
        "total_observations": total_observations,
        "evaluated_observations": evaluated_count,
        "masked_stockout_count": masked_stockout_count,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "wape": wape,
        "wape_diagnostic": wape_diagnostic,
        "bias": round(bias, 4),
        "total_actual_demand": round(sum_actual, 2),
        "total_predicted_demand": round(sum_predicted, 2),
    }


def get_product_demand_classification(
    db: Session,
    product_id: int,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    """
    Categorizes every calendar date in [start_date, end_date] into mutually exclusive semantics:
    - GENUINE_TRANSACTION_POSITIVE_NET: Fulfilled order date with net demand > 0.
    - GENUINE_TRANSACTION_FULLY_RETURNED: Fulfilled order date where gross sales were fully offset by returns (net = 0).
    - CONFIRMED_ZERO: Verified positive stock availability where zero sales occurred (true zero demand).
    - STOCKOUT_CENSORED: Date where ending physical stock was 0 (demand unobserved / censored).
    - UNCERTAIN_AVAILABILITY: Date preceding earliest inventory log or where historical state cannot be verified.

    Does NOT expose customer-identifying information.
    """
    df = SalesHistoryService.get_product_daily_demand(
        db=db,
        product_id=product_id,
        start_date=start_date,
        end_date=end_date,
        demand_type="gross",
    )

    genuine_tx_count = 0
    genuine_positive_net_count = 0
    genuine_fully_returned_count = 0
    confirmed_zero_count = 0
    stockout_censored_count = 0
    uncertain_count = 0

    genuine_dates: list[str] = []
    daily_classifications: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        d_str = str(row["date"])
        is_so = bool(row["is_stockout"])
        so_status = str(row["stockout_status"])
        gross = float(row["gross_demand"])
        net = float(row["net_demand"])
        ret = float(row["returned_units"])
        cnt = int(row["order_count"])

        if gross > 0.0 or cnt > 0:
            genuine_tx_count += 1
            genuine_dates.append(d_str)
            if net > 0.0:
                tag = "GENUINE_TRANSACTION_POSITIVE_NET"
                genuine_positive_net_count += 1
            else:
                tag = "GENUINE_TRANSACTION_FULLY_RETURNED"
                genuine_fully_returned_count += 1
        elif is_so:
            tag = "STOCKOUT_CENSORED"
            stockout_censored_count += 1
        elif so_status == "UNCERTAIN":
            tag = "UNCERTAIN_AVAILABILITY"
            uncertain_count += 1
        elif so_status == "AVAILABLE":
            tag = "CONFIRMED_ZERO"
            confirmed_zero_count += 1
        else:
            tag = "UNCERTAIN_AVAILABILITY"
            uncertain_count += 1

        daily_classifications.append({
            "date": d_str,
            "classification": tag,
            "gross_demand": gross,
            "returned_units": ret,
            "net_demand": net,
            "stockout_status": so_status,
        })

    total_days = len(df)
    total_gross = float(df["gross_demand"].sum())
    total_returned = float(df["returned_units"].sum())
    total_net = float(df["net_demand"].sum())

    return {
        "start_date": str(start_date),
        "end_date": str(end_date),
        "total_calendar_days": total_days,
        "genuine_transaction_days": genuine_tx_count,
        "genuine_positive_net_days": genuine_positive_net_count,
        "genuine_fully_returned_days": genuine_fully_returned_count,
        "confirmed_zero_days": confirmed_zero_count,
        "stockout_censored_days": stockout_censored_count,
        "uncertain_availability_days": uncertain_count,
        "genuine_sale_dates": genuine_dates,
        "total_gross_demand": round(total_gross, 2),
        "total_returned_units": round(total_returned, 2),
        "total_net_demand": round(total_net, 2),
        "daily_classifications": daily_classifications,
    }


def assess_product_backtest_readiness(
    db: Session,
    product_id: int,
    thresholds: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Evaluates whether a product has sufficient genuine sales transactions
    for a statistically meaningful chronological backtest.

    Prevents spurious backtests on series where calendar reindexing created
    80+ days of artificial zero demand.
    """
    cfg = dict(DEFAULT_READINESS_THRESHOLDS)
    if thresholds:
        cfg.update(thresholds)

    min_active_days = cfg["min_active_days"]
    min_calendar_days = cfg["min_calendar_days"]
    min_units = cfg["min_units"]
    min_density = cfg["min_density"]

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product with ID {product_id} not found")

    # 1. Query genuine fulfilled sales orders
    sales_info = (
        db.query(
            func.count(func.distinct(SalesOrder.id)).label("order_count"),
            func.count(SalesOrderItem.id).label("line_item_count"),
            func.coalesce(func.sum(SalesOrderItem.quantity), 0).label("total_units"),
            func.min(func.date(SalesOrder.sale_date)).label("earliest_sale_date"),
            func.max(func.date(SalesOrder.sale_date)).label("latest_sale_date"),
            func.count(func.distinct(func.date(SalesOrder.sale_date))).label("distinct_sale_dates"),
        )
        .join(SalesOrderItem, SalesOrderItem.sales_order_id == SalesOrder.id)
        .filter(
            SalesOrderItem.product_id == product_id,
            SalesOrder.status.in_(FULFILLED_ORDER_STATUSES),
        )
        .first()
    )

    order_count = int(getattr(sales_info, "order_count", 0) or 0)
    total_units = float(getattr(sales_info, "total_units", 0.0) or 0.0)
    distinct_dates = int(getattr(sales_info, "distinct_sale_dates", 0) or 0)
    earliest_date = getattr(sales_info, "earliest_sale_date", None)
    latest_date = getattr(sales_info, "latest_sale_date", None)

    # 2. Query inventory log history
    log_info = (
        db.query(
            func.count(InventoryLog.id).label("log_count"),
            func.min(func.date(InventoryLog.timestamp)).label("earliest_log_date"),
            func.max(func.date(InventoryLog.timestamp)).label("latest_log_date"),
            func.count(InventoryLog.id).filter(InventoryLog.new_quantity == 0).label("zero_stock_events"),
        )
        .filter(InventoryLog.product_id == product_id)
        .first()
    )

    log_count = int(getattr(log_info, "log_count", 0) or 0)
    zero_stock_events = int(getattr(log_info, "zero_stock_events", 0) or 0)
    earliest_log = getattr(log_info, "earliest_log_date", None)

    # 3. Calculate calendar metrics
    d_earliest = _to_date(earliest_date)
    d_latest = _to_date(latest_date)
    if d_earliest and d_latest:
        calendar_span = (d_latest - d_earliest).days + 1
        density = round(distinct_dates / calendar_span, 4) if calendar_span > 0 else 0.0
    else:
        calendar_span = 0
        density = 0.0

    # 4. Detailed demand classification over active span if available
    demand_class: Optional[dict[str, Any]] = None
    if d_earliest and d_latest:
        try:
            demand_class = get_product_demand_classification(db, product_id, d_earliest, d_latest)
        except Exception:
            demand_class = None

    # 5. Determine eligibility blockers
    blockers: list[str] = []
    if order_count == 0:
        blockers.append("Zero fulfilled sales orders recorded.")
    if distinct_dates < min_active_days:
        blockers.append(f"Only {distinct_dates} distinct sale dates (minimum required: {min_active_days}).")
    if calendar_span < min_calendar_days:
        blockers.append(f"Calendar span of {calendar_span} days is shorter than required minimum of {min_calendar_days} days.")
    if total_units < min_units:
        blockers.append(f"Cumulative sales of {total_units:.0f} units is below minimum threshold of {min_units} units.")
    if density < min_density:
        blockers.append(f"Transaction date density is {density:.1%} (below threshold of {min_density:.0%}). 100% imputed zeros dominate.")

    is_eligible = len(blockers) == 0

    return {
        "product_id": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "current_stock": product.quantity,
        "reorder_level": product.reorder_level,
        "is_eligible_for_backtest": is_eligible,
        "readiness_status": "ELIGIBLE" if is_eligible else "INSUFFICIENT_OBSERVATIONS",
        "thresholds_applied": cfg,
        "genuine_observations": {
            "fulfilled_orders": order_count,
            "distinct_sale_dates": distinct_dates,
            "total_units_sold": total_units,
            "earliest_sale_date": str(d_earliest) if d_earliest else None,
            "latest_sale_date": str(d_latest) if d_latest else None,
        },
        "inventory_history": {
            "log_count": log_count,
            "earliest_log_date": str(earliest_log) if earliest_log else None,
            "zero_stock_events": zero_stock_events,
            "has_uncertain_history": log_count == 0,
        },
        "calendar_metrics": {
            "calendar_span_days": calendar_span,
            "imputed_zero_days": max(0, calendar_span - distinct_dates),
            "observation_density": density,
        },
        "demand_classification": demand_class,
        "blockers": blockers,
    }


def run_chronological_baseline_backtest(
    db: Session,
    product_id: int,
    holdout_days: int = 14,
    min_pre_holdout_history: int = 28,
    thresholds: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Executes an expanding-window chronological holdout backtest comparing:
    - Naive-1 (Yesterday's Demand)
    - Seasonal Naive-7 (Same day-of-week 7 days ago)
    - SMA-28 (28-day simple moving average)

    Evaluation Policy:
    1. Models are strictly compared on identical holdout dates.
    2. Confirmed stockout dates (ending stock == 0) are masked out of accuracy metrics.
    3. If the product fails eligibility criteria, returns INSUFFICIENT_OBSERVATIONS
       without reporting spurious metrics.
    4. WAPE handles zero-demand holdouts gracefully without crashing.
    """
    readiness = assess_product_backtest_readiness(db, product_id, thresholds)

    # Gating check: Do not execute backtesting if data coverage is inadequate
    if not readiness["is_eligible_for_backtest"]:
        return {
            "product_id": readiness["product_id"],
            "product_name": readiness["product_name"],
            "status": "INSUFFICIENT_OBSERVATIONS",
            "eligible": False,
            "message": (
                "Product does not have sufficient genuine sales history for chronological backtesting. "
                "A real-data benchmark cannot be claimed until real sales observations meet eligibility thresholds."
            ),
            "blockers": readiness["blockers"],
            "genuine_observations": readiness["genuine_observations"],
            "calendar_metrics": readiness["calendar_metrics"],
            "models": {},
        }

    d_earliest = _to_date(readiness["genuine_observations"]["earliest_sale_date"])
    d_latest = _to_date(readiness["genuine_observations"]["latest_sale_date"])

    if not d_earliest or not d_latest:
        raise ValueError("Missing dates for eligible product")

    # Fetch daily demand panel
    df = SalesHistoryService.get_product_daily_demand(
        db=db,
        product_id=product_id,
        start_date=d_earliest,
        end_date=d_latest,
        demand_type="gross",
    )

    total_days = len(df)
    if total_days < holdout_days + min_pre_holdout_history:
        return {
            "product_id": readiness["product_id"],
            "product_name": readiness["product_name"],
            "status": "INSUFFICIENT_OBSERVATIONS",
            "eligible": False,
            "message": f"Total panel length ({total_days} days) is less than required ({holdout_days + min_pre_holdout_history} days).",
            "blockers": [f"Need at least {holdout_days + min_pre_holdout_history} continuous calendar days."],
            "models": {},
        }

    # Split: Training window vs Holdout window
    cutoff_idx = total_days - holdout_days
    train_df = df.iloc[:cutoff_idx]
    holdout_df = df.iloc[cutoff_idx:]

    holdout_dates = [d.isoformat() if hasattr(d, "isoformat") else str(d) for d in holdout_df["date"]]
    holdout_actuals = holdout_df["units"].values.astype(float)
    holdout_stockouts = holdout_df["is_stockout"].values.astype(bool)
    holdout_uncertain = (holdout_df["stockout_status"] == "UNCERTAIN").values.astype(bool)

    # Exclude both confirmed stockout dates and uncertain availability dates from error metrics
    eval_mask = holdout_stockouts | holdout_uncertain

    # Expanding window simulation
    full_units = list(train_df["units"].values.astype(float))

    preds_naive1 = []
    preds_snaive7 = []
    preds_sma28 = []

    for step_idx in range(holdout_days):
        current_history = np.array(full_units, dtype=float)

        # Model 1: Naive-1 (Demand yesterday)
        p_n1 = float(current_history[-1]) if len(current_history) >= 1 else 0.0

        # Model 2: Seasonal Naive-7 (Demand 7 days ago)
        p_sn7 = float(current_history[-7]) if len(current_history) >= 7 else p_n1

        # Model 3: SMA-28 (28-day moving average)
        lookback_slice = current_history[-28:] if len(current_history) >= 28 else current_history
        p_sma28 = max(0.0, round(float(np.mean(lookback_slice)), 2))

        preds_naive1.append(p_n1)
        preds_snaive7.append(p_sn7)
        preds_sma28.append(p_sma28)

        # Expand window with actual observed unit demand
        full_units.append(float(holdout_actuals[step_idx]))

    # Compute metrics for each baseline on identical holdout dates
    metrics_naive1 = calculate_forecast_metrics(holdout_actuals, preds_naive1, stockout_mask=eval_mask)
    metrics_snaive7 = calculate_forecast_metrics(holdout_actuals, preds_snaive7, stockout_mask=eval_mask)
    metrics_sma28 = calculate_forecast_metrics(holdout_actuals, preds_sma28, stockout_mask=eval_mask)

    evaluated_dates_count = int(np.sum(~eval_mask))
    masked_stockout_count = int(np.sum(holdout_stockouts))
    uncertain_dates_count = int(np.sum(holdout_uncertain))

    # If all holdout observations were masked out, return diagnostic status rather than fabricated metrics
    if evaluated_dates_count == 0:
        return {
            "product_id": readiness["product_id"],
            "product_name": readiness["product_name"],
            "status": "NO_EVALUATION_OBSERVATIONS",
            "eligible": True,
            "message": "All dates in the holdout window were masked due to confirmed stockouts or uncertain availability.",
            "blockers": ["No unmasked holdout dates available for error metric evaluation."],
            "holdout_window": {
                "start_date": str(holdout_df.iloc[0]["date"]),
                "end_date": str(holdout_df.iloc[-1]["date"]),
                "holdout_days": holdout_days,
                "evaluated_dates_count": 0,
                "masked_stockout_dates_count": masked_stockout_count,
                "uncertain_availability_dates_count": uncertain_dates_count,
            },
            "best_baseline_model": "NONE",
            "models": {
                "NAIVE_1": {
                    "name": "Naive-1 (Yesterday's Demand)",
                    "metrics": metrics_naive1,
                    "predictions": preds_naive1,
                },
                "SEASONAL_NAIVE_7": {
                    "name": "Seasonal Naive-7 (7 Days Prior)",
                    "metrics": metrics_snaive7,
                    "predictions": preds_snaive7,
                },
                "SMA_28": {
                    "name": "28-Day Simple Moving Average",
                    "metrics": metrics_sma28,
                    "predictions": preds_sma28,
                },
            },
            "holdout_actuals": list(holdout_actuals),
            "holdout_dates": holdout_dates,
        }

    # Determine winning model based on MAE
    model_maes = {
        "NAIVE_1": metrics_naive1["mae"],
        "SEASONAL_NAIVE_7": metrics_snaive7["mae"],
        "SMA_28": metrics_sma28["mae"],
    }
    valid_maes = {k: v for k, v in model_maes.items() if v is not None}
    best_model = min(valid_maes, key=valid_maes.get) if valid_maes else "NONE"

    return {
        "product_id": readiness["product_id"],
        "product_name": readiness["product_name"],
        "status": "ELIGIBLE_EVALUATED",
        "eligible": True,
        "holdout_window": {
            "start_date": str(holdout_df.iloc[0]["date"]),
            "end_date": str(holdout_df.iloc[-1]["date"]),
            "holdout_days": holdout_days,
            "evaluated_dates_count": evaluated_dates_count,
            "masked_stockout_dates_count": masked_stockout_count,
            "uncertain_availability_dates_count": uncertain_dates_count,
        },
        "best_baseline_model": best_model,
        "models": {
            "NAIVE_1": {
                "name": "Naive-1 (Yesterday's Demand)",
                "metrics": metrics_naive1,
                "predictions": preds_naive1,
            },
            "SEASONAL_NAIVE_7": {
                "name": "Seasonal Naive-7 (7 Days Prior)",
                "metrics": metrics_snaive7,
                "predictions": preds_snaive7,
            },
            "SMA_28": {
                "name": "28-Day Simple Moving Average",
                "metrics": metrics_sma28,
                "predictions": preds_sma28,
            },
        },
        "holdout_actuals": list(holdout_actuals),
        "holdout_dates": holdout_dates,
    }


def generate_catalog_readiness_audit(db: Session, thresholds: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """
    Performs a complete read-only readiness audit across all products in the database.
    Distinguishes genuine sales observations from calendar-imputed zeros.
    """
    products = db.query(Product).order_by(Product.id).all()
    catalog_audit = []
    eligible_count = 0

    for p in products:
        readiness = assess_product_backtest_readiness(db, p.id, thresholds)
        if readiness["is_eligible_for_backtest"]:
            eligible_count += 1
        catalog_audit.append(readiness)

    total_products = len(products)

    return {
        "audit_timestamp": date.today().isoformat(),
        "total_catalog_products": total_products,
        "eligible_for_backtesting_count": eligible_count,
        "ineligible_count": total_products - eligible_count,
        "readiness_summary": "FEASIBLE" if eligible_count > 0 else "NO_ELIGIBLE_PRODUCTS",
        "recommendation": (
            "Sufficient real transaction history available for baseline backtesting."
            if eligible_count > 0
            else "Real transaction history is too sparse for meaningful chronological backtesting. "
            "Defer holdout evaluation until active sales observations accumulate to avoid spurious all-zero evaluation scores."
        ),
        "products": catalog_audit,
    }
