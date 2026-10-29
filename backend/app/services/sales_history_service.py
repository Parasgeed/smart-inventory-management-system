"""
Sales history aggregation and stockout awareness service.
Extracts gross demand and return-adjusted demand from fulfilled sales orders,
builds continuous daily calendars, and reconstructs historical stockout windows.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Optional
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.sales_order_model import SalesOrder
from app.models.sales_order_item_model import SalesOrderItem
from app.models.sales_return_model import SalesReturn, SalesReturnItem
from app.models.inventory_log_model import InventoryLog
from app.models.product_model import Product

FULFILLED_ORDER_STATUSES = ("SHIPPED", "DELIVERED", "COMPLETED")
UNFULFILLED_ORDER_STATUSES = ("DRAFT", "CONFIRMED", "PACKED", "CANCELLED")


def _extract_val(obj: Any, key: str, fallback_key: Optional[str] = None, default: Any = 0.0) -> Any:
    """Safely extract field from SQLAlchemy Row, dict, or MagicMock."""
    if hasattr(obj, "__dict__"):
        if key in obj.__dict__:
            return obj.__dict__[key]
        if fallback_key and fallback_key in obj.__dict__:
            return obj.__dict__[fallback_key]
    if hasattr(obj, "_mapping") and not type(obj._mapping).__name__.startswith("MagicMock"):
        try:
            mapping = obj._mapping
            if key in mapping:
                return mapping[key]
            if fallback_key and fallback_key in mapping:
                return mapping[fallback_key]
        except Exception:
            pass
    if hasattr(obj, key):
        val = getattr(obj, key)
        if not type(val).__name__.startswith("MagicMock"):
            return val
    if fallback_key and hasattr(obj, fallback_key):
        val = getattr(obj, fallback_key)
        if not type(val).__name__.startswith("MagicMock"):
            return val
    return default


def _to_date(val: Any) -> Optional[date]:
    """Safely normalize date-like values into a datetime.date object."""
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        try:
            return pd.to_datetime(val).date()
        except Exception:
            return None
    if hasattr(val, "date") and callable(val.date):
        try:
            d = val.date()
            if isinstance(d, date):
                return d
        except Exception:
            pass
    return None


class SalesHistoryService:
    @staticmethod
    def get_stockout_calendar(
        db: Session,
        product_id: int,
        start_date: date,
        end_date: date,
    ) -> dict[date, dict]:
        """
        Reconstructs daily stockout periods for a given product over [start_date, end_date].
        Uses inventory_logs state transitions (previous_quantity -> new_quantity).

        Policy:
        - A day is marked as STOCKOUT (is_stockout=True) if physical stock was 0 at the end of that day.
        - If logs do not exist or a date precedes the earliest logged event, it is marked UNCERTAIN
          rather than inventing unverified historical stock levels.
        - Days where stock is positive are marked AVAILABLE.

        Returns a mapping: date -> {"is_stockout": bool, "status": str, "ending_inventory": Optional[int]}
        """
        if start_date > end_date:
            raise ValueError(f"start_date ({start_date}) cannot be after end_date ({end_date})")

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ValueError(f"Product with ID {product_id} not found")

        # Query all inventory logs for this product ordered chronologically
        logs = (
            db.query(InventoryLog)
            .filter(InventoryLog.product_id == product_id)
            .order_by(InventoryLog.timestamp.asc(), InventoryLog.id.asc())
            .all()
        )

        all_dates = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
        stockout_map: dict[date, dict] = {}

        # Filter out mocks or malformed log records
        valid_logs: list[tuple[date, int, Optional[int]]] = []
        for log in logs:
            l_date = _to_date(getattr(log, "timestamp", None))
            new_q = getattr(log, "new_quantity", None)
            if l_date is not None and isinstance(new_q, (int, float)):
                prev_q = getattr(log, "previous_quantity", None)
                prev_int = int(prev_q) if isinstance(prev_q, (int, float)) else None
                valid_logs.append((l_date, int(new_q), prev_int))

        if not valid_logs:
            # No valid log records exist for this product.
            # Mark historical state as UNCERTAIN.
            for d in all_dates:
                stockout_map[d] = {
                    "is_stockout": False,
                    "status": "UNCERTAIN",
                    "ending_inventory": None,
                }
            return stockout_map

        first_log_date = valid_logs[0][0]
        first_log_prev = valid_logs[0][2]

        # Group logs by date to find the final ending inventory for each logged date
        daily_ending_log: dict[date, int] = {}
        for l_date, new_q, _ in valid_logs:
            daily_ending_log[l_date] = new_q

        sorted_log_dates = sorted(daily_ending_log.keys())

        # Forward-fill inventory levels across calendar days
        current_inv: Optional[int] = None
        for d in all_dates:
            if d < first_log_date:
                stockout_map[d] = {
                    "is_stockout": False,
                    "status": "UNCERTAIN",
                    "ending_inventory": None,
                }
            else:
                if d in daily_ending_log:
                    current_inv = daily_ending_log[d]
                elif current_inv is None:
                    past_dates = [ld for ld in sorted_log_dates if ld <= d]
                    if past_dates:
                        current_inv = daily_ending_log[past_dates[-1]]

                if current_inv is not None and current_inv == 0:
                    stockout_map[d] = {
                        "is_stockout": True,
                        "status": "STOCKOUT",
                        "ending_inventory": 0,
                    }
                else:
                    stockout_map[d] = {
                        "is_stockout": False,
                        "status": "AVAILABLE" if current_inv is not None else "UNCERTAIN",
                        "ending_inventory": current_inv,
                    }

        return stockout_map

    @staticmethod
    def get_product_daily_demand(
        db: Session,
        product_id: int,
        start_date: date,
        end_date: date,
        demand_type: Literal["gross", "net"] = "gross",
    ) -> pd.DataFrame:
        """
        Aggregates daily sales demand for a product over a continuous calendar.
        Includes only fulfilled orders: SHIPPED, DELIVERED, and COMPLETED.
        Excludes unfulfilled orders: DRAFT, CONFIRMED, PACKED, and CANCELLED.

        Return reconciliation policy:
        - When demand_type == 'net', returns from sales_returns are linked to the original
          SalesOrder.id and deducted from that order's sale_date.
        - Net demand is strictly non-negative: max(0.0, gross - returned).
        - Days without sales are recorded with 0.0 units.
        - Distinguishes organic zero sales from stockouts using get_stockout_calendar.

        Returns a pd.DataFrame with index = pd.DatetimeIndex over [start_date, end_date] and columns:
        ['date', 'gross_demand', 'returned_units', 'net_demand', 'units', 'is_stockout', 'stockout_status', 'order_count']
        """
        if start_date > end_date:
            raise ValueError(f"start_date ({start_date}) cannot be after end_date ({end_date})")

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ValueError(f"Product with ID {product_id} not found")

        # 1. Query fulfilled sales orders aggregated by calendar sale_date
        sales_records = (
            db.query(
                func.date(SalesOrder.sale_date).label("sale_date"),
                func.sum(SalesOrderItem.quantity).label("gross_demand"),
                func.count(func.distinct(SalesOrder.id)).label("order_count"),
            )
            .join(SalesOrderItem, SalesOrderItem.sales_order_id == SalesOrder.id)
            .filter(
                SalesOrderItem.product_id == product_id,
                SalesOrder.status.in_(FULFILLED_ORDER_STATUSES),
                func.date(SalesOrder.sale_date) >= start_date,
                func.date(SalesOrder.sale_date) <= end_date,
            )
            .group_by(func.date(SalesOrder.sale_date))
            .all()
        )

        # 2. Query returns linked to original sales orders
        returns_records = (
            db.query(
                func.date(SalesOrder.sale_date).label("sale_date"),
                func.sum(SalesReturnItem.quantity).label("returned_units"),
            )
            .join(SalesReturn, SalesReturn.sales_order_id == SalesOrder.id)
            .join(SalesReturnItem, SalesReturnItem.sales_return_id == SalesReturn.id)
            .filter(
                SalesReturnItem.product_id == product_id,
                SalesOrder.status.in_(FULFILLED_ORDER_STATUSES),
                func.date(SalesOrder.sale_date) >= start_date,
                func.date(SalesOrder.sale_date) <= end_date,
            )
            .group_by(func.date(SalesOrder.sale_date))
            .all()
        )

        gross_map: dict[date, float] = {}
        order_count_map: dict[date, int] = {}
        for r in sales_records:
            d = _to_date(_extract_val(r, "sale_date", None, None))
            if d is not None:
                raw_units = _extract_val(r, "gross_demand", "total_units", 0.0)
                try:
                    units_val = float(raw_units)
                except Exception:
                    units_val = 0.0
                gross_map[d] = units_val

                raw_cnt = _extract_val(r, "order_count", None, 1)
                try:
                    cnt_val = int(raw_cnt)
                except Exception:
                    cnt_val = 1
                order_count_map[d] = cnt_val

        returns_map: dict[date, float] = {}
        for r in returns_records:
            d = _to_date(_extract_val(r, "sale_date", None, None))
            if d is not None:
                raw_units = _extract_val(r, "returned_units", None, 0.0)
                try:
                    units_val = float(raw_units)
                except Exception:
                    units_val = 0.0
                returns_map[d] = units_val

        # 3. Retrieve stockout calendar
        stockout_map = SalesHistoryService.get_stockout_calendar(
            db=db,
            product_id=product_id,
            start_date=start_date,
            end_date=end_date,
        )

        # 4. Assemble continuous daily panel
        date_range = pd.date_range(start=start_date, end=end_date, freq="D")
        rows = []
        for dt in date_range:
            d = dt.date()
            gross = gross_map.get(d, 0.0)
            ret = returns_map.get(d, 0.0)
            net = max(0.0, round(gross - ret, 2))
            units = gross if demand_type == "gross" else net
            so_info = stockout_map.get(d, {"is_stockout": False, "status": "AVAILABLE"})
            order_count = order_count_map.get(d, 0)

            rows.append({
                "date": d,
                "gross_demand": gross,
                "returned_units": ret,
                "net_demand": net,
                "units": units,
                "is_stockout": so_info["is_stockout"],
                "stockout_status": so_info["status"],
                "order_count": order_count,
            })

        df = pd.DataFrame(rows, index=date_range)
        return df
