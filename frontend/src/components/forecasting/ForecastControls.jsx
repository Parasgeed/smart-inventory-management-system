// frontend/src/components/forecasting/ForecastControls.jsx
import { useState, useId } from 'react';

const HORIZON_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

const MODEL_OPTIONS = [
  { value: 'BASELINE_SMA28', label: 'SMA-28 Moving Average (Recommended Baseline)' },
  { value: 'CATBOOST_V3_EXPERIMENTAL', label: 'CatBoost V3 Causal (Experimental Simulation)' },
  { value: 'CATBOOST_V2_EXPERIMENTAL', label: 'CatBoost V2 (Legacy Audit / Rollback)' },
];

export default function ForecastControls({
  products = [],
  selectedProductId = '',
  horizonDays = 7,
  holidayFlag = 0,
  discountPct = 0,
  modelPreference = 'BASELINE_SMA28',
  loading = false,
  onProductChange,
  onHorizonChange,
  onHolidayChange,
  onDiscountChange,
  onModelChange,
  onSubmit,
}) {
  const productSelectId = useId();
  const modelSelectId = useId();
  const holidayCheckId = useId();
  const discountInputId = useId();
  const [scenarioOpen, setScenarioOpen] = useState(true);

  const handleProductSelect = (e) => {
    const val = e.target.value;
    onProductChange(val ? Number(val) : '');
  };

  const handleDiscountInput = (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 100) val = 100;
    onDiscountChange(val);
  };

  return (
    <form
      aria-label="Demand Forecast Configuration"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)] space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
        {/* Product Selector (Span 4) */}
        <div className="lg:col-span-4 space-y-1.5">
          <label htmlFor={productSelectId} className="block text-caption font-semibold text-ink">
            Target Inventory Product <span className="text-red-500">*</span>
          </label>
          <select
            id={productSelectId}
            value={selectedProductId}
            onChange={handleProductSelect}
            disabled={loading}
            className="w-full px-3.5 py-2.5 bg-canvas-cream border border-hairline-light rounded-md text-body-md font-sans focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">-- Choose a product to forecast --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku || `ID: ${p.id}`}) · Stock: {p.quantity ?? 0}
              </option>
            ))}
          </select>
          <p className="text-micro text-shade-50">
            {products.length} products loaded from catalog.
          </p>
        </div>

        {/* Horizon Selector (Span 3) */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="block text-caption font-semibold text-ink">
            Forecast Horizon
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-canvas-cream rounded-md border border-hairline-light">
            {HORIZON_OPTIONS.map((opt) => {
              const isSelected = Number(horizonDays) === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => onHorizonChange(opt.value)}
                  disabled={loading}
                  aria-pressed={isSelected}
                  className={`py-1.5 px-1.5 text-micro font-semibold rounded transition-all duration-150 text-center cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-shade-60 hover:text-ink hover:bg-canvas-light'
                  } disabled:opacity-60`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-micro text-shade-50">
            {horizonDays} calendar days projected.
          </p>
        </div>

        {/* Forecasting Method / Model Selector (Span 3) */}
        <div className="lg:col-span-3 space-y-1.5">
          <label htmlFor={modelSelectId} className="block text-caption font-semibold text-ink">
            Forecasting Model
          </label>
          <select
            id={modelSelectId}
            value={modelPreference}
            onChange={(e) => onModelChange?.(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 bg-canvas-cream border border-hairline-light rounded-md text-caption font-sans focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all cursor-pointer disabled:opacity-60"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="text-micro text-shade-50">
            {modelPreference === 'BASELINE_SMA28'
              ? 'Transparent 28-day moving average'
              : modelPreference === 'CATBOOST_V3_EXPERIMENTAL'
              ? 'Isolated causal research simulation'
              : 'Legacy leakage model (audit only)'}
          </p>
        </div>

        {/* Submit / Refresh Button (Span 2) */}
        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={loading || !selectedProductId}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-primary text-on-primary font-semibold text-caption rounded-md hover:bg-shade-70 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-on-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scenario Simulation Controls (Accordion/Sub-bar) */}
      <div className="pt-4 border-t border-hairline-light">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-left text-shade-60">
            <span className="text-eyebrow-cap font-mono uppercase tracking-wider font-bold">
              Simulation Scenario Parameters
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
              {/* Holiday Toggle */}
              <label htmlFor={holidayCheckId} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  id={holidayCheckId}
                  type="checkbox"
                  checked={holidayFlag === 1}
                  onChange={(e) => onHolidayChange(e.target.checked ? 1 : 0)}
                  disabled={loading}
                  className="w-4 h-4 rounded text-ink border-shade-40 focus:ring-ink cursor-pointer disabled:opacity-60"
                />
                <span className="text-caption font-medium text-ink">
                  Holiday / Promotional Event Active
                </span>
              </label>

              {/* Discount Percentage Input */}
              <div className="flex items-center gap-2">
                <label htmlFor={discountInputId} className="text-caption font-medium text-shade-60">
                  Planned Discount (%):
                </label>
                <div className="relative w-24">
                  <input
                    id={discountInputId}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discountPct}
                    onChange={handleDiscountInput}
                    disabled={loading}
                    className="w-full px-2.5 py-1 text-right font-mono text-body-md bg-canvas-cream border border-hairline-light rounded-md pr-7 focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-micro font-mono text-shade-50 pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>
        </div>
      </div>
    </form>
  );
}
