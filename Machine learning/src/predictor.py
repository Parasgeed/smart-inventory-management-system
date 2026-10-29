"""
ML Demand Predictor Module (EXPERIMENTAL)
Wraps CatBoost V2 model for demand forecasting inference.

WARNING: The underlying model artifact was trained with feature target leakage
(Demand_Change_1 = Units Sold.diff(1)). Predictions produced by this module
are experimental heuristics and must not be treated as statistically validated forecasts.
"""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor

_ML_DIR = Path(__file__).resolve().parents[1]
_MODEL_PATH = _ML_DIR / "models" / "catboost_feature_v2_inventory_removed.cbm"
_METADATA_PATH = _ML_DIR / "models" / "catboost_feature_v2_metadata.pkl"

_MODEL_V3_PATH = _ML_DIR / "models" / "catboost_demand_model_v3_clean.cbm"
_METADATA_V3_PATH = _ML_DIR / "models" / "catboost_v3_metadata.pkl"

_model: CatBoostRegressor | None = None
_metadata: dict[str, Any] | None = None

_model_v3: CatBoostRegressor | None = None
_metadata_v3: dict[str, Any] | None = None


def load_model() -> tuple[CatBoostRegressor, dict[str, Any]]:
    global _model, _metadata
    if _model is None:
        if not _MODEL_PATH.exists():
            raise FileNotFoundError(f"Model file not found at {_MODEL_PATH}")
        _model = CatBoostRegressor()
        _model.load_model(str(_MODEL_PATH))
        with open(_METADATA_PATH, "rb") as f:
            _metadata = pickle.load(f)
    return _model, _metadata


def load_v3_model() -> tuple[CatBoostRegressor, dict[str, Any]]:
    """Loads the clean, leakage-free CatBoost V3 model and metadata."""
    global _model_v3, _metadata_v3
    if _model_v3 is None:
        if not _MODEL_V3_PATH.exists():
            raise FileNotFoundError(f"V3 model file not found at {_MODEL_V3_PATH}")
        _model_v3 = CatBoostRegressor()
        _model_v3.load_model(str(_MODEL_V3_PATH))
        with open(_METADATA_V3_PATH, "rb") as f:
            _metadata_v3 = pickle.load(f)
    return _model_v3, _metadata_v3


def compute_step_features(
    target_date: pd.Timestamp,
    history_series: pd.Series,  # Continuous daily sales up to target_date - 1 day
    product_id_str: str,
    category_name: str,
    price: float,
    discount_pct: float = 0.0,
    holiday_flag: int = 0,
    competitor_price: float | None = None,
    store_id: str = "S001",
    region: str = "North",
    weather: str = "Sunny",
) -> pd.DataFrame:
    """
    Computes exactly the 40 features in required order for a single target date.
    history_series must contain at least 28 continuous daily values ending on target_date - 1 day.
    """
    if len(history_series) < 28:
        raise ValueError(f"Need >= 28 continuous days of history, got {len(history_series)}")

    if competitor_price is None:
        competitor_price = price * 1.05

    # Lags relative to target_date
    lag_1 = float(history_series.iloc[-1])
    lag_2 = float(history_series.iloc[-2])
    lag_3 = float(history_series.iloc[-3])
    lag_7 = float(history_series.iloc[-7])
    lag_14 = float(history_series.iloc[-14])
    lag_21 = float(history_series.iloc[-21])
    lag_28 = float(history_series.iloc[-28])

    # Rolling windows over preceding history
    roll_7 = history_series.iloc[-7:]
    roll_14 = history_series.iloc[-14:]
    roll_28 = history_series.iloc[-28:]

    rolling_mean_7 = float(roll_7.mean())
    rolling_mean_14 = float(roll_14.mean())
    rolling_mean_28 = float(roll_28.mean())

    rolling_std_7 = float(roll_7.std(ddof=1)) if len(roll_7) > 1 else 0.0
    rolling_std_28 = float(roll_28.std(ddof=1)) if len(roll_28) > 1 else 0.0
    if np.isnan(rolling_std_7):
        rolling_std_7 = 0.0
    if np.isnan(rolling_std_28):
        rolling_std_28 = 0.0

    rolling_min_7 = float(roll_7.min())
    rolling_max_7 = float(roll_7.max())

    demand_momentum_7_28 = rolling_mean_7 / rolling_mean_28 if rolling_mean_28 != 0 else np.nan
    demand_trend_7_28 = rolling_mean_7 - rolling_mean_28
    demand_cv_7 = rolling_std_7 / rolling_mean_7 if rolling_mean_7 != 0 else np.nan

    # Runtime heuristic for leaked training feature: momentum continuity
    demand_change_1 = lag_1 - lag_2

    price_diff = price - competitor_price
    price_ratio = price / competitor_price if competitor_price != 0 else np.nan
    rel_premium = (price - competitor_price) / competitor_price if competitor_price != 0 else np.nan
    effective_price = price * (1.0 - discount_pct / 100.0)
    promotion_discount = holiday_flag * discount_pct

    season_map = {
        12: "Winter", 1: "Winter", 2: "Winter",
        3: "Spring", 4: "Spring", 5: "Spring",
        6: "Summer", 7: "Summer", 8: "Summer",
        9: "Autumn", 10: "Autumn", 11: "Autumn",
    }
    seasonality = season_map[target_date.month]

    feature_dict = {
        "Store ID": str(store_id),
        "Product ID": str(product_id_str),
        "Category": str(category_name),
        "Region": str(region),
        "Weather Condition": str(weather),
        "Seasonality": str(seasonality),
        "Price": float(price),
        "Discount": float(discount_pct),
        "Holiday/Promotion": float(holiday_flag),
        "Competitor Pricing": float(competitor_price),
        "Year": int(target_date.year),
        "Month": int(target_date.month),
        "Day": int(target_date.day),
        "Day_of_Week": int(target_date.dayofweek),
        "Week_of_Year": int(target_date.isocalendar().week),
        "Quarter": int(target_date.quarter),
        "Is_Weekend": int(1 if target_date.dayofweek >= 5 else 0),
        "Lag_1": lag_1,
        "Lag_2": lag_2,
        "Lag_3": lag_3,
        "Lag_7": lag_7,
        "Lag_14": lag_14,
        "Lag_21": lag_21,
        "Lag_28": lag_28,
        "Rolling_Mean_7": rolling_mean_7,
        "Rolling_Mean_14": rolling_mean_14,
        "Rolling_Mean_28": rolling_mean_28,
        "Rolling_Std_7": rolling_std_7,
        "Rolling_Std_28": rolling_std_28,
        "Rolling_Min_7": rolling_min_7,
        "Rolling_Max_7": rolling_max_7,
        "Demand_Momentum_7_28": demand_momentum_7_28,
        "Demand_Trend_7_28": demand_trend_7_28,
        "Demand_CV_7": demand_cv_7,
        "Demand_Change_1": demand_change_1,
        "Price_Difference": price_diff,
        "Price_Ratio": price_ratio,
        "Relative_Price_Premium": rel_premium,
        "Effective_Price": effective_price,
        "Promotion_Discount": promotion_discount,
    }

    return pd.DataFrame([feature_dict])


def predict_step(feature_df: pd.DataFrame) -> float:
    """Predict demand for a single precomputed feature row."""
    model, metadata = load_model()
    cols = metadata["feature_columns"]
    X = feature_df[cols]
    pred = model.predict(X)[0]
    return max(float(pred), 0.0)


# Import and re-export V3 clean causal feature computation
try:
    from feature_pipeline import (
        compute_step_features_v3,
        FEATURE_COLUMNS as FEATURE_COLUMNS_V3,
        CATEGORICAL_FEATURES as CATEGORICAL_FEATURES_V3,
    )
except ImportError:
    from .feature_pipeline import (  # type: ignore
        compute_step_features_v3,
        FEATURE_COLUMNS as FEATURE_COLUMNS_V3,
        CATEGORICAL_FEATURES as CATEGORICAL_FEATURES_V3,
    )


def predict_step_v3(feature_df: pd.DataFrame) -> float:
    """Predict demand using the leakage-free CatBoost V3 model."""
    model, metadata = load_v3_model()
    cols = metadata["feature_columns"]
    X = feature_df[cols]
    pred = model.predict(X)[0]
    return max(float(pred), 0.0)
