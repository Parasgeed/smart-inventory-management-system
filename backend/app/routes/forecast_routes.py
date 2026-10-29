from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.auth.dependencies import get_current_user
from app.schemas.forecast_schema import (
    ForecastRequest,
    ForecastResponse,
    ReadinessDiagnosticResponse,
    CatalogReadinessAuditResponse,
    BacktestRequest,
    BacktestResponse,
)
from app.services.forecast_service import generate_forecast
from app.services.forecast_eval_service import (
    assess_product_backtest_readiness,
    generate_catalog_readiness_audit,
    run_chronological_baseline_backtest,
)

router = APIRouter(
    prefix="/forecast",
    tags=["Forecasting (Experimental)"]
)

@router.post("/demand", response_model=ForecastResponse)
def get_demand_forecast(
    request: ForecastRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate an experimental multi-day demand forecast for a single product.

    NOTICE: Outputs are labelled EXPERIMENTAL_UNVALIDATED due to known model training limitations.
    This advisory forecast should not be used for automated purchase decisions.
    """
    try:
        result = generate_forecast(
            db=db,
            product_id=request.product_id,
            horizon_days=request.horizon_days,
            holiday_flag=request.holiday_flag,
            discount_pct=request.discount_pct,
            model_preference=request.model_preference or "BASELINE_SMA28",
        )
        return ForecastResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting engine error: {str(e)}"
        )


@router.get("/readiness", response_model=CatalogReadinessAuditResponse)
def get_catalog_readiness(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Retrieve read-only dataset readiness audit across all catalog products.
    Distinguishes genuine sales observations from calendar-imputed zeros.
    """
    try:
        return generate_catalog_readiness_audit(db=db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Readiness audit error: {str(e)}"
        )


@router.get("/readiness/{product_id}", response_model=ReadinessDiagnosticResponse)
def get_product_readiness(
    product_id: int = Path(..., gt=0, description="Database Product ID"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Retrieve read-only forecasting and backtest readiness diagnostic for a specific product.
    Includes genuine transaction counts, observation density, and eligibility blockers.
    """
    try:
        return assess_product_backtest_readiness(db=db, product_id=product_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Product readiness diagnostic error: {str(e)}"
        )


@router.post("/backtest", response_model=BacktestResponse)
def execute_baseline_backtest(
    request: BacktestRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Executes an expanding-window chronological holdout backtest comparing
    Naive-1, Seasonal Naive-7, and SMA-28 on identical holdout dates.

    NOTICE: If the product does not meet genuine observation thresholds,
    returns INSUFFICIENT_OBSERVATIONS rather than claiming benchmark accuracy.
    """
    try:
        return run_chronological_baseline_backtest(
            db=db,
            product_id=request.product_id,
            holdout_days=request.holdout_days,
            min_pre_holdout_history=request.min_pre_holdout_history,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backtesting error: {str(e)}"
        )
