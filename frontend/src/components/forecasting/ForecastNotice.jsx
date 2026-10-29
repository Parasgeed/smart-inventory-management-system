// frontend/src/components/forecasting/ForecastNotice.jsx

/**
 * Renders governance, model validity, and history adequacy notices.
 * In accordance with ethical UI design standards, experimental ML forecasts
 * MUST prominently display the EXPERIMENTAL_UNVALIDATED warning.
 */
export default function ForecastNotice({ forecastData }) {
  if (!forecastData) return null;

  const {
    model_status,
    status,
    forecast_method,
    history_days_available,
    history_days_required = 28,
    stockout_days_detected = 0,
    warnings = [],
  } = forecastData;

  const isExperimental = model_status === 'EXPERIMENTAL_UNVALIDATED';
  const isBaseline = model_status === 'BASELINE_HEURISTIC' || status === 'PARTIAL_HISTORY';
  const isInsufficient = status === 'INSUFFICIENT_HISTORY';

  return (
    <div className="space-y-3" data-testid="forecast-notice-container">
      {/* 0. Historical Stockout Warning Banner */}
      {stockout_days_detected > 0 && (
        <div
          role="alert"
          aria-label="Stockout Censoring Notice"
          className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-md shadow-sm"
          data-testid="stockout-warning-banner"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 text-orange-600 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <div className="flex items-center gap-2">
                <h4 className="text-body-strong font-bold text-orange-900 tracking-tight">
                  Historical Stockout Censoring Detected
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-eyebrow-cap font-mono font-bold bg-orange-200 text-orange-900 uppercase">
                  {stockout_days_detected} STOCKOUT DAY{stockout_days_detected > 1 ? 'S' : ''}
                </span>
              </div>
              <p className="text-caption text-orange-800 mt-1 leading-relaxed">
                This product experienced {stockout_days_detected} day(s) with zero physical stock during the lookback period. Zero recorded sales on those days reflect inventory stockouts rather than genuine lack of customer demand. Demand projections may understate unconstrained sales velocity.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* 1. Mandatory Prominent Experimental Model Notice */}
      {isExperimental && (
        <div
          role="alert"
          aria-label="Experimental Model Notice"
          className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md shadow-sm"
          data-testid="experimental-warning-banner"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 text-amber-600 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <div className="flex items-center gap-2">
                <h4 className="text-body-strong font-bold text-amber-900 tracking-tight">
                  {forecast_method === 'CATBOOST_V3_EXPERIMENTAL'
                    ? 'EXPERIMENTAL RESEARCH SIMULATION'
                    : 'EXPERIMENTAL MODEL NOTICE'}
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-eyebrow-cap font-mono font-bold bg-amber-200 text-amber-900 uppercase">
                  EXPERIMENTAL_UNVALIDATED
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-eyebrow-cap font-mono font-bold bg-amber-100 text-amber-800 uppercase">
                  {forecast_method || 'CATBOOST_EXPERIMENTAL'}
                </span>
              </div>
              <p className="text-caption text-amber-800 mt-1 leading-relaxed">
                {forecast_method === 'CATBOOST_V3_EXPERIMENTAL'
                  ? 'This forecast was produced by an experimental CatBoost V3 model evaluated via 5-fold walk-forward cross-validation (MAE 89.32 vs SMA-28 MAE 89.84, with no statistically significant advantage). Trained on synthetic benchmark data with near-zero temporal autocorrelation. Daily predictions are exploratory simulation heuristics and must not be used for automated purchase decisions.'
                  : 'This forecast was produced by an experimental CatBoost V2 model containing unvalidated feature engineering. Daily predictions are exploratory simulation heuristics for planning only and must not be used for automated purchasing decisions or guaranteed production targets.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Baseline Moving Average Notice */}
      {isBaseline && (
        <div
          role="status"
          aria-label="Baseline Heuristic Fallback Notice"
          className="bg-sky-50 border-l-4 border-sky-500 p-4 rounded-r-md shadow-sm"
          data-testid="baseline-fallback-banner"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 text-sky-600 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <div className="flex items-center gap-2">
                <h4 className="text-body-strong font-bold text-sky-900 tracking-tight">
                  {forecast_method === 'SMA_28_BASELINE'
                    ? 'Baseline 28-Day Simple Moving Average Applied'
                    : 'Baseline Heuristic Fallback Applied'}
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-eyebrow-cap font-mono font-bold bg-sky-200 text-sky-900 uppercase">
                  {forecast_method || 'FALLBACK_MOVING_AVERAGE'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-eyebrow-cap font-mono font-bold bg-sky-100 text-sky-800 uppercase">
                  BASELINE_HEURISTIC
                </span>
              </div>
              <p className="text-caption text-sky-800 mt-1 leading-relaxed">
                {forecast_method === 'SMA_28_BASELINE'
                  ? `Transparent statistical baseline calculated from the preceding 28 days of continuous sales history (${history_days_available || 28} days on record). Recommended reliable production baseline.`
                  : `This product has fewer than ${history_days_required} days of historical sales records (${history_days_available || 0} days recorded). Daily projections use a simple moving average baseline rather than ML regression.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Insufficient History Notice */}
      {isInsufficient && (
        <div
          role="alert"
          aria-label="Insufficient History Notice"
          className="bg-zinc-100 border-l-4 border-zinc-500 p-4 rounded-r-md shadow-sm"
          data-testid="insufficient-history-banner"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 text-zinc-600 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <div className="flex items-center gap-2">
                <h4 className="text-body-strong font-bold text-zinc-900 tracking-tight">
                  Insufficient Sales History for Forecasting
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-eyebrow-cap font-mono font-bold bg-zinc-300 text-zinc-900 uppercase">
                  INSUFFICIENT_HISTORY
                </span>
              </div>
              <p className="text-caption text-zinc-700 mt-1 leading-relaxed">
                No completed sales transactions have been recorded for this product. At least {history_days_required} continuous
                days of sales history are required to train or evaluate machine learning demand forecasts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Additional backend warning messages */}
      {warnings && warnings.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-md text-caption text-amber-900">
          <ul className="list-disc list-inside space-y-1">
            {warnings.map((w, idx) => (
              <li key={idx} className="font-mono text-micro">{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
