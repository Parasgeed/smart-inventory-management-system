"""
Leakage-Free Causal Feature Pipeline (V3)
=========================================
Single source of truth for causal demand feature engineering.
Used symmetrically across:
  1. Offline model training and walk-forward cross-validation.
  2. Online single-step recursive inference in the forecasting service.

Causal Guarantee:
  For any prediction at date T, all demand statistics (lags, rolling aggregates,
  differencing) are calculated strictly on observations tau <= T - 1.
  No observation from tau >= T is ever accessed or leaked into the feature vector.
"""
from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd

# The exact 32 causal feature columns in deterministic order
FEATURE_COLUMNS: list[str] = [
    # 1. Historical Demand Lags (all shift >= 1)
    "Lag_1",
    "Lag_2",
    "Lag_3",
    "Lag_7",
    "Lag_14",
    "Lag_21",
    "Lag_28",
    # 2. Causal Historical Deltas (replaces leaked Demand_Change_1)
    "Lag_Diff_1_2",
    "Lag_Diff_1_7",
    # 3. Shifted Rolling Aggregates (strictly over history ending at T-1)
    "Rolling_Mean_7",
    "Rolling_Mean_14",
    "Rolling_Mean_28",
    "Rolling_Std_7",
    "Rolling_Std_28",
    "Rolling_Min_7",
    "Rolling_Max_7",
    "Demand_Momentum_7_28",
    "Demand_Trend_7_28",
    "Demand_CV_7",
    # 4. Deterministic Calendar Features (known in advance for target date T)
    "Year",
    "Month",
    "Day",
    "Day_of_Week",
    "Week_of_Year",
    "Quarter",
    "Is_Weekend",
    # 5. Managerial & Scenario Features (controllable planned inputs for target date T)
    "Category",
    "Price",
    "Discount",
    "Effective_Price",
    "Promotion_Discount",
    "Holiday/Promotion",
]

CATEGORICAL_FEATURES: list[str] = ["Category"]

# Expected dtypes dictionary for strict schema validation
FEATURE_DTYPES: dict[str, str] = {
    "Lag_1": "float64",
    "Lag_2": "float64",
    "Lag_3": "float64",
    "Lag_7": "float64",
    "Lag_14": "float64",
    "Lag_21": "float64",
    "Lag_28": "float64",
    "Lag_Diff_1_2": "float64",
    "Lag_Diff_1_7": "float64",
    "Rolling_Mean_7": "float64",
    "Rolling_Mean_14": "float64",
    "Rolling_Mean_28": "float64",
    "Rolling_Std_7": "float64",
    "Rolling_Std_28": "float64",
    "Rolling_Min_7": "float64",
    "Rolling_Max_7": "float64",
    "Demand_Momentum_7_28": "float64",
    "Demand_Trend_7_28": "float64",
    "Demand_CV_7": "float64",
    "Year": "int64",
    "Month": "int64",
    "Day": "int64",
    "Day_of_Week": "int64",
    "Week_of_Year": "int64",
    "Quarter": "int64",
    "Is_Weekend": "int64",
    "Category": "object",
    "Price": "float64",
    "Discount": "float64",
    "Effective_Price": "float64",
    "Promotion_Discount": "float64",
    "Holiday/Promotion": "float64",
}


def compute_step_features_v3(
    target_date: pd.Timestamp,
    history_series: pd.Series,  # Continuous daily sales strictly up to target_date - 1 day
    category_name: str,
    price: float,
    discount_pct: float = 0.0,
    holiday_flag: float | int = 0.0,
) -> pd.DataFrame:
    """
    Computes exactly the 32 causal features for a single target date T.
    
    Guarantees:
      - history_series contains historical values ending at T - 1 day.
      - Zero access to actual or future target values at >= T.
      - Safe zero-division guards for momentum and coefficient of variation.
    """
    if len(history_series) < 28:
        raise ValueError(f"Need >= 28 continuous days of history, got {len(history_series)}")

    # 1. Historical Lags relative to target_date
    lag_1 = float(history_series.iloc[-1])
    lag_2 = float(history_series.iloc[-2])
    lag_3 = float(history_series.iloc[-3])
    lag_7 = float(history_series.iloc[-7])
    lag_14 = float(history_series.iloc[-14])
    lag_21 = float(history_series.iloc[-21])
    lag_28 = float(history_series.iloc[-28])

    # 2. Causal Lagged Deltas (strictly historical)
    lag_diff_1_2 = lag_1 - lag_2
    lag_diff_1_7 = lag_1 - lag_7

    # 3. Rolling windows over history ending at T - 1
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

    # Safe zero-division guarded momentum & CV
    demand_momentum_7_28 = (
        rolling_mean_7 / rolling_mean_28 if rolling_mean_28 > 0 else 1.0
    )
    demand_trend_7_28 = rolling_mean_7 - rolling_mean_28
    demand_cv_7 = (
        rolling_std_7 / rolling_mean_7 if rolling_mean_7 > 0 else 0.0
    )

    # 4. Deterministic Calendar Features for target_date T
    year = int(target_date.year)
    month = int(target_date.month)
    day = int(target_date.day)
    day_of_week = int(target_date.dayofweek)
    week_of_year = int(target_date.isocalendar().week)
    quarter = int(target_date.quarter)
    is_weekend = int(1 if target_date.dayofweek >= 5 else 0)

    # 5. Managerial & Scenario Features for target_date T
    price_val = float(price)
    discount_val = float(discount_pct)
    holiday_val = float(holiday_flag)
    effective_price = price_val * (1.0 - discount_val / 100.0)
    promotion_discount = holiday_val * discount_val

    feature_dict: dict[str, Any] = {
        "Lag_1": lag_1,
        "Lag_2": lag_2,
        "Lag_3": lag_3,
        "Lag_7": lag_7,
        "Lag_14": lag_14,
        "Lag_21": lag_21,
        "Lag_28": lag_28,
        "Lag_Diff_1_2": lag_diff_1_2,
        "Lag_Diff_1_7": lag_diff_1_7,
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
        "Year": year,
        "Month": month,
        "Day": day,
        "Day_of_Week": day_of_week,
        "Week_of_Year": week_of_year,
        "Quarter": quarter,
        "Is_Weekend": is_weekend,
        "Category": str(category_name),
        "Price": price_val,
        "Discount": discount_val,
        "Effective_Price": effective_price,
        "Promotion_Discount": promotion_discount,
        "Holiday/Promotion": holiday_val,
    }

    df = pd.DataFrame([feature_dict])[FEATURE_COLUMNS]
    # Enforce exact dtypes
    for col, dtype in FEATURE_DTYPES.items():
        if dtype != "object":
            df[col] = df[col].astype(dtype)
    return df


def build_feature_dataframe_v3(
    df: pd.DataFrame,
    group_cols: list[str] | tuple[str, ...] = ("Store ID", "Product ID"),
    target_col: str = "Units Sold",
    date_col: str = "Date",
) -> pd.DataFrame:
    """
    Vectorized batch feature engineering for offline training and backtesting.
    Applies strict shifts to ensure that every row at date T has features derived
    exclusively from tau <= T - 1.
    
    Produces columns and mathematical values identical to compute_step_features_v3.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    group_cols_list = list(group_cols)
    df = df.sort_values(group_cols_list + [date_col]).reset_index(drop=True)

    grouped = df.groupby(group_cols_list)[target_col]

    # 1. Historical Lags (shift >= 1 guarantees causal isolation)
    for k in [1, 2, 3, 7, 14, 21, 28]:
        df[f"Lag_{k}"] = grouped.shift(k)

    # 2. Causal Lagged Deltas (historical only)
    df["Lag_Diff_1_2"] = df["Lag_1"] - df["Lag_2"]
    df["Lag_Diff_1_7"] = df["Lag_1"] - df["Lag_7"]

    # 3. Shifted Rolling Aggregates
    # Critical: shift(1) ensures the rolling window at row T excludes Units Sold at T.
    shifted_target = grouped.shift(1)

    df["Rolling_Mean_7"] = (
        shifted_target.groupby(df[group_cols_list[0]] if len(group_cols_list) == 1 else [df[c] for c in group_cols_list])
        .rolling(window=7, min_periods=7)
        .mean()
        .reset_index(drop=True)
    )
    df["Rolling_Mean_14"] = (
        shifted_target.groupby(df[group_cols_list[0]] if len(group_cols_list) == 1 else [df[c] for c in group_cols_list])
        .rolling(window=14, min_periods=14)
        .mean()
        .reset_index(drop=True)
    )
    df["Rolling_Mean_28"] = (
        shifted_target.groupby(df[group_cols_list[0]] if len(group_cols_list) == 1 else [df[c] for c in group_cols_list])
        .rolling(window=28, min_periods=28)
        .mean()
        .reset_index(drop=True)
    )

    rolling_std_7_raw = (
        shifted_target.groupby(df[group_cols_list[0]] if len(group_cols_list) == 1 else [df[c] for c in group_cols_list])
        .rolling(window=7, min_periods=7)
        .std(ddof=1)
        .reset_index(drop=True)
    )
    df["Rolling_Std_7"] = rolling_std_7_raw.fillna(0.0)

    rolling_std_28_raw = (
        shifted_target.groupby(df[group_cols_list[0]] if len(group_cols_list) == 1 else [df[c] for c in group_cols_list])
        .rolling(window=28, min_periods=28)
        .std(ddof=1)
        .reset_index(drop=True)
    )
    df["Rolling_Std_28"] = rolling_std_28_raw.fillna(0.0)

    df["Rolling_Min_7"] = (
        shifted_target.groupby(df[group_cols_list[0]] if len(group_cols_list) == 1 else [df[c] for c in group_cols_list])
        .rolling(window=7, min_periods=7)
        .min()
        .reset_index(drop=True)
    )
    df["Rolling_Max_7"] = (
        shifted_target.groupby(df[group_cols_list[0]] if len(group_cols_list) == 1 else [df[c] for c in group_cols_list])
        .rolling(window=7, min_periods=7)
        .max()
        .reset_index(drop=True)
    )

    # Safe ratios
    df["Demand_Momentum_7_28"] = np.where(
        df["Rolling_Mean_28"] > 0,
        df["Rolling_Mean_7"] / df["Rolling_Mean_28"],
        1.0,
    )
    df["Demand_Trend_7_28"] = df["Rolling_Mean_7"] - df["Rolling_Mean_28"]
    df["Demand_CV_7"] = np.where(
        df["Rolling_Mean_7"] > 0,
        df["Rolling_Std_7"] / df["Rolling_Mean_7"],
        0.0,
    )

    # 4. Deterministic Calendar Features
    df["Year"] = df[date_col].dt.year.astype("int64")
    df["Month"] = df[date_col].dt.month.astype("int64")
    df["Day"] = df[date_col].dt.day.astype("int64")
    df["Day_of_Week"] = df[date_col].dt.dayofweek.astype("int64")
    df["Week_of_Year"] = df[date_col].dt.isocalendar().week.astype("int64")
    df["Quarter"] = df[date_col].dt.quarter.astype("int64")
    df["Is_Weekend"] = (df["Day_of_Week"] >= 5).astype("int64")

    # 5. Managerial & Scenario Features
    df["Price"] = df["Price"].astype("float64")
    df["Discount"] = df["Discount"].astype("float64")
    df["Holiday/Promotion"] = df["Holiday/Promotion"].astype("float64")
    df["Effective_Price"] = df["Price"] * (1.0 - df["Discount"] / 100.0)
    df["Promotion_Discount"] = df["Holiday/Promotion"] * df["Discount"]
    df["Category"] = df["Category"].astype(str)

    # Filter out initial warm-up period where lag_28 or rolling_28 is NaN
    df = df.dropna(subset=["Lag_28", "Rolling_Mean_28"]).reset_index(drop=True)

    # Ensure output has strict feature column ordering and dtypes
    for col, dtype in FEATURE_DTYPES.items():
        if dtype != "object":
            df[col] = df[col].astype(dtype)

    return df
