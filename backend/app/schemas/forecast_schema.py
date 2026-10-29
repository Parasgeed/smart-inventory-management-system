from pydantic import BaseModel, Field
from datetime import date
from typing import Optional, Literal, Any

class ForecastRequest(BaseModel):
    product_id: int = Field(..., description="Database Product ID")
    horizon_days: int = Field(default=7, ge=1, le=90, description="Forecast horizon in days (1-90)")
    holiday_flag: int = Field(default=0, ge=0, le=1, description="Holiday or promotional event indicator")
    discount_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="Planned discount percentage")
    model_preference: Optional[Literal["BASELINE_SMA28", "CATBOOST_V3_EXPERIMENTAL", "CATBOOST_V2_EXPERIMENTAL"]] = Field(
        default="BASELINE_SMA28",
        description="Forecasting model to use: default BASELINE_SMA28, or isolated CATBOOST_V3_EXPERIMENTAL, or legacy CATBOOST_V2_EXPERIMENTAL",
    )


class DailyForecast(BaseModel):
    date: date
    predicted_units: float


class RestockRecommendation(BaseModel):
    current_stock: int
    days_of_stock_remaining: Optional[float]
    recommended_reorder_qty: int
    reorder_urgency: Literal["CRITICAL", "LOW", "ADEQUATE"]


class ForecastResponse(BaseModel):
    product_id: int
    product_name: str
    status: Literal["SUCCESS", "BASELINE_SUCCESS", "EXPERIMENTAL_SUCCESS", "INSUFFICIENT_HISTORY", "PARTIAL_HISTORY"]
    model_status: Literal["BASELINE_HEURISTIC", "EXPERIMENTAL_UNVALIDATED", "NONE"]
    forecast_method: Literal["SMA_28_BASELINE", "CATBOOST_V3_EXPERIMENTAL", "CATBOOST_V2_EXPERIMENTAL", "FALLBACK_MOVING_AVERAGE", "NONE"]
    forecast_generated_at: str
    history_cutoff_date: date
    forecast_start_date: date
    history_days_available: int
    history_days_required: int = 28
    horizon_days: int
    forecasts: list[DailyForecast]
    restock_recommendation: RestockRecommendation
    stockout_days_detected: Optional[int] = Field(default=0, description="Count of historical stockout days within evaluation lookback")
    warnings: list[str] = []


class ReadinessDiagnosticResponse(BaseModel):
    product_id: int
    product_name: str
    sku: str
    current_stock: int
    reorder_level: int
    is_eligible_for_backtest: bool
    readiness_status: str
    thresholds_applied: dict[str, Any]
    genuine_observations: dict[str, Any]
    inventory_history: dict[str, Any]
    calendar_metrics: dict[str, Any]
    demand_classification: Optional[dict[str, Any]] = None
    blockers: list[str] = []


class CatalogReadinessAuditResponse(BaseModel):
    audit_timestamp: str
    total_catalog_products: int
    eligible_for_backtesting_count: int
    ineligible_count: int
    readiness_summary: str
    recommendation: str
    products: list[ReadinessDiagnosticResponse]


class BacktestRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="Product ID to evaluate")
    holdout_days: int = Field(default=14, ge=7, le=60, description="Holdout window in days")
    min_pre_holdout_history: int = Field(default=28, ge=28, le=180, description="Minimum training history required before holdout")


class BacktestResponse(BaseModel):
    product_id: int
    product_name: str
    status: str
    eligible: bool
    message: Optional[str] = None
    best_baseline_model: Optional[str] = None
    blockers: list[str] = []
    genuine_observations: Optional[dict[str, Any]] = None
    calendar_metrics: Optional[dict[str, Any]] = None
    holdout_window: Optional[dict[str, Any]] = None
    models: dict[str, Any] = {}
    holdout_actuals: Optional[list[float]] = None
    holdout_dates: Optional[list[str]] = None
