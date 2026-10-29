// frontend/src/pages/ForecastingPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getProductForecast,
  getAllProducts,
  getProductById,
} from '../api/forecastApi';

import ForecastNotice from '../components/forecasting/ForecastNotice';
import ForecastControls from '../components/forecasting/ForecastControls';
import ForecastMetrics from '../components/forecasting/ForecastMetrics';
import ForecastChart from '../components/forecasting/ForecastChart';
import ForecastTable from '../components/forecasting/ForecastTable';

export default function ForecastingPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL query parameter for deep-linking
  const urlProductId = searchParams.get('product_id') || searchParams.get('productId') || '';

  // Core forecast inputs
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(urlProductId ? Number(urlProductId) : '');
  const [horizonDays, setHorizonDays] = useState(7);
  const [holidayFlag, setHolidayFlag] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [modelPreference, setModelPreference] = useState('BASELINE_SMA28');

  // Async UI states
  const [productsLoading, setProductsLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [error, setError] = useState(null);

  // Track initial auto-fetch to avoid duplicate triggers
  const initialFetchDone = useRef(false);

  // 1. Load product catalog on mount
  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setProductsLoading(true);
      try {
        const list = await getAllProducts();
        if (isMounted) {
          // If a product_id was provided in URL query, ensure it exists in products list
          if (urlProductId) {
            const numId = Number(urlProductId);
            const found = list.some((p) => p.id === numId);
            if (!found) {
              try {
                const single = await getProductById(numId);
                if (single && isMounted) {
                  list.unshift(single);
                }
              } catch {
                // If single product fetch fails, proceed with list
              }
            }
          }
          setProducts(list);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load products for forecasting:', err);
        }
      } finally {
        if (isMounted) {
          setProductsLoading(false);
        }
      }
    }

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [urlProductId]);

  // 2. Forecast generation callback
  const runForecast = useCallback(
    async (overrideParams = {}) => {
      const pid = overrideParams.productId ?? selectedProductId;
      const hDays = overrideParams.horizonDays ?? horizonDays;
      const hFlag = overrideParams.holidayFlag ?? holidayFlag;
      const dPct = overrideParams.discountPct ?? discountPct;
      const mPref = overrideParams.modelPreference ?? modelPreference;

      if (!pid) {
        setForecastData(null);
        setError(null);
        return;
      }

      setForecastLoading(true);
      setError(null);

      try {
        const data = await getProductForecast({
          productId: pid,
          horizonDays: hDays,
          holidayFlag: hFlag,
          discountPct: dPct,
          modelPreference: mPref,
        });
        setForecastData(data);
      } catch (err) {
        console.error('Demand forecast error:', err);
        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        if (status === 404) {
          setError(detail || 'Product not found. Please select an active inventory product.');
        } else if (status === 422) {
          setError(
            typeof detail === 'string'
              ? detail
              : 'Validation error: Please verify horizon (1-90 days) and discount (0-100%).'
          );
        } else if (status === 401) {
          setError('Session expired or unauthorized. Please re-authenticate.');
        } else {
          setError(
            detail || 'Unable to generate forecast from engine. Please verify backend status and retry.'
          );
        }
        setForecastData(null);
      } finally {
        setForecastLoading(false);
      }
    },
    [selectedProductId, horizonDays, holidayFlag, discountPct, modelPreference]
  );

  // 3. Auto-trigger forecast when deep-linking with URL product_id
  useEffect(() => {
    if (urlProductId && !initialFetchDone.current) {
      initialFetchDone.current = true;
      setSelectedProductId(Number(urlProductId));
      runForecast({ productId: Number(urlProductId) });
    }
  }, [urlProductId, runForecast]);

  // Synchronize URL query param when product changes
  const handleProductChange = (newProductId) => {
    initialFetchDone.current = true;
    setSelectedProductId(newProductId);
    if (newProductId) {
      setSearchParams({ product_id: newProductId });
      runForecast({ productId: newProductId });
    } else {
      setSearchParams({});
      setForecastData(null);
      setError(null);
    }
  };

  const handleHorizonChange = (newHorizon) => {
    setHorizonDays(newHorizon);
    if (selectedProductId) {
      runForecast({ horizonDays: newHorizon });
    }
  };

  const handleHolidayChange = (newFlag) => {
    setHolidayFlag(newFlag);
  };

  const handleDiscountChange = (newDiscount) => {
    setDiscountPct(newDiscount);
  };

  const handleModelChange = (newModel) => {
    setModelPreference(newModel);
    if (selectedProductId) {
      runForecast({ modelPreference: newModel });
    }
  };

  const handleManualSubmit = () => {
    runForecast();
  };

  // Find currently selected product object from loaded catalog
  const currentProduct = products.find((p) => p.id === Number(selectedProductId));

  return (
    <div className="space-y-8 font-sans pb-16" data-testid="forecasting-page">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-display-md font-display font-light text-ink tracking-tight">
              Demand Forecasting
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-micro font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
              SIMULATION ONLY
            </span>
          </div>
          <p className="text-caption text-shade-50 mt-1">
            Simulate multi-day demand projections and review advisory restocking recommendations.
          </p>
        </div>
      </div>

      {/* Forecast Controls Card */}
      <ForecastControls
        products={products}
        selectedProductId={selectedProductId}
        horizonDays={horizonDays}
        holidayFlag={holidayFlag}
        discountPct={discountPct}
        modelPreference={modelPreference}
        loading={forecastLoading || productsLoading}
        onProductChange={handleProductChange}
        onHorizonChange={handleHorizonChange}
        onHolidayChange={handleHolidayChange}
        onDiscountChange={handleDiscountChange}
        onModelChange={handleModelChange}
        onSubmit={handleManualSubmit}
      />

      {/* Error Callout */}
      {error && (
        <div
          role="alert"
          aria-label="Forecasting Error"
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md shadow-sm"
          data-testid="forecast-error-banner"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3">
                <h4 className="text-body-strong font-bold text-red-800">Forecasting Error</h4>
                <p className="text-caption text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => runForecast()}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-caption font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {forecastLoading && (
        <div className="space-y-6" data-testid="forecast-loading-state">
          <div className="flex items-center justify-center p-12 bg-canvas-light rounded-lg border border-hairline-light">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-ink" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-caption font-medium text-shade-60 font-mono">
                Running demand simulation model...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Idle / No Product Selected State */}
      {!selectedProductId && !forecastLoading && !error && (
        <div
          className="bg-canvas-light p-12 rounded-lg border border-dashed border-shade-30 text-center"
          data-testid="forecast-empty-prompt"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-canvas-cream flex items-center justify-center text-shade-50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <h3 className="text-heading-sm font-semibold text-ink">Select a Product to Begin Forecasting</h3>
          <p className="text-caption text-shade-50 max-w-md mx-auto mt-1">
            Pick an item above to simulate daily demand, visualize sales trends, and view advisory restocking metrics.
          </p>
        </div>
      )}

      {/* Forecast Results View */}
      {forecastData && !forecastLoading && (
        <div className="space-y-6" data-testid="forecast-results-section">
          {/* Prominent Governance & Status Notice */}
          <ForecastNotice forecastData={forecastData} />

          {/* Metric KPI Cards */}
          <ForecastMetrics forecastData={forecastData} product={currentProduct} />

          {/* Chart & Daily Table (Rendered when forecasts exist, or empty chart for insufficient history) */}
          {forecastData.status !== 'INSUFFICIENT_HISTORY' &&
          forecastData.forecasts &&
          forecastData.forecasts.length > 0 ? (
            <>
              <ForecastChart
                forecasts={forecastData.forecasts}
                horizonDays={forecastData.horizon_days || horizonDays}
              />
              <ForecastTable
                forecasts={forecastData.forecasts}
                product={currentProduct}
                horizonDays={forecastData.horizon_days || horizonDays}
              />
            </>
          ) : (
            <ForecastChart
              forecasts={[]}
              horizonDays={forecastData.horizon_days || horizonDays}
            />
          )}
        </div>
      )}
    </div>
  );
}
