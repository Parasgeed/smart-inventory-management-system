// frontend/src/components/forecasting/ForecastMetrics.jsx
import { useNavigate } from 'react-router-dom';

export default function ForecastMetrics({ forecastData, product }) {
  const navigate = useNavigate();

  if (!forecastData) return null;

  const {
    product_id,
    horizon_days = 7,
    forecasts = [],
    restock_recommendation = {},
  } = forecastData;

  const {
    current_stock = product?.quantity ?? 0,
    days_of_stock_remaining,
    recommended_reorder_qty = 0,
    reorder_urgency = 'ADEQUATE',
  } = restock_recommendation;

  const totalForecastedUnits = forecasts.reduce(
    (acc, cur) => acc + (Number(cur.predicted_units) || 0),
    0
  );

  const avgDailyUnits = horizon_days > 0 ? (totalForecastedUnits / horizon_days).toFixed(1) : 0;

  // Urgency styling mapping
  const urgencyStyles = {
    CRITICAL: 'bg-red-50 text-red-700 border-red-200',
    LOW: 'bg-amber-50 text-amber-700 border-amber-200',
    ADEQUATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const handleDraftOrderInPurchases = () => {
    // Navigate to Purchases page with prefilled draft state for manual review.
    // In accordance with governance rule 6, this NEVER auto-submits or creates an order.
    navigate('/purchases', {
      state: {
        action: 'restock',
        productId: product_id,
        quantity: recommended_reorder_qty > 0 ? recommended_reorder_qty : 1,
      },
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="forecast-metrics">
      {/* 1. On-Hand Inventory */}
      <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300">
        <span className="text-caption text-shade-50 font-semibold block">On-Hand Inventory</span>
        <span className="text-3xl font-display font-light text-ink block mt-2 font-mono">
          {current_stock} <span className="text-body-md text-shade-50 font-sans">units</span>
        </span>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-micro text-shade-40">
            Reorder Level: <strong className="font-mono text-shade-60">{product?.reorder_level ?? 5}</strong>
          </span>
        </div>
      </div>

      {/* 2. Projected Demand */}
      <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300">
        <span className="text-caption text-shade-50 font-semibold block">Projected Total Demand</span>
        <span className="text-3xl font-display font-light text-ink block mt-2 font-mono">
          {totalForecastedUnits.toFixed(1)} <span className="text-body-md text-shade-50 font-sans">units</span>
        </span>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-micro text-shade-40">
            Avg: <strong className="font-mono text-shade-60">{avgDailyUnits} units/day</strong> ({horizon_days}d horizon)
          </span>
        </div>
      </div>

      {/* 3. Stock Runway & Urgency */}
      <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300">
        <div className="flex justify-between items-start">
          <span className="text-caption text-shade-50 font-semibold block">Stock Runway</span>
          <span
            className={`px-2 py-0.5 text-eyebrow-cap font-mono font-bold rounded-full border ${
              urgencyStyles[reorder_urgency] || urgencyStyles.ADEQUATE
            }`}
          >
            {reorder_urgency}
          </span>
        </div>
        <span className="text-3xl font-display font-light text-ink block mt-2 font-mono">
          {days_of_stock_remaining !== null && days_of_stock_remaining !== undefined
            ? `${Number(days_of_stock_remaining).toFixed(1)}`
            : '—'}
          <span className="text-body-md text-shade-50 font-sans"> days</span>
        </span>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-micro text-shade-40">
            {reorder_urgency === 'CRITICAL'
              ? 'Immediate stockout risk'
              : reorder_urgency === 'LOW'
              ? 'Approaching reorder threshold'
              : 'Sufficient on-hand inventory'}
          </span>
        </div>
      </div>

      {/* 4. Advisory Reorder Recommendation */}
      <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start">
            <span className="text-caption text-shade-50 font-semibold block">Recommended Reorder</span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
              ADVISORY ONLY
            </span>
          </div>
          <span className="text-3xl font-display font-light text-ink block mt-2 font-mono">
            {recommended_reorder_qty}{' '}
            <span className="text-body-md text-shade-50 font-sans">units</span>
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-hairline-light">
          <button
            type="button"
            onClick={handleDraftOrderInPurchases}
            disabled={!product_id}
            aria-label="Draft in Purchases"
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-canvas-cream hover:bg-zinc-200 border border-hairline-light rounded text-caption font-semibold text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-shade-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Draft in Purchases</span>
          </button>
          <p className="text-[10px] text-shade-40 text-center mt-1">
            Prefills PO draft for operator review. No auto-order.
          </p>
        </div>
      </div>
    </div>
  );
}
