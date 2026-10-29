// frontend/src/tests/ForecastingPage.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ForecastingPage from '../pages/ForecastingPage';
import client from '../api/client';

// Mock the axios client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockProducts = [
  {
    id: 1,
    name: 'Wireless Mouse',
    sku: 'SKU-WM-001',
    quantity: 15,
    reorder_level: 5,
    selling_price: 29.99,
    cost_price: 15.0,
  },
  {
    id: 2,
    name: 'Mechanical Keyboard',
    sku: 'SKU-KB-002',
    quantity: 3,
    reorder_level: 10,
    selling_price: 89.99,
    cost_price: 45.0,
  },
];

// Default transparent baseline forecast (SMA-28)
const mockSma28Forecast = {
  product_id: 1,
  product_name: 'Wireless Mouse',
  status: 'SUCCESS',
  model_status: 'BASELINE_HEURISTIC',
  forecast_method: 'SMA_28_BASELINE',
  forecast_generated_at: '2026-10-22T10:00:00Z',
  history_cutoff_date: '2026-10-21',
  forecast_start_date: '2026-10-22',
  history_days_available: 35,
  history_days_required: 28,
  horizon_days: 7,
  forecasts: [
    { date: '2026-10-22', predicted_units: 8.5 },
    { date: '2026-10-23', predicted_units: 8.5 },
    { date: '2026-10-24', predicted_units: 8.5 },
    { date: '2026-10-25', predicted_units: 8.5 },
    { date: '2026-10-26', predicted_units: 8.5 },
    { date: '2026-10-27', predicted_units: 8.5 },
    { date: '2026-10-28', predicted_units: 8.5 },
  ],
  restock_recommendation: {
    current_stock: 15,
    days_of_stock_remaining: 1.8,
    recommended_reorder_qty: 45,
    reorder_urgency: 'CRITICAL',
  },
  warnings: [],
};

// Experimental CatBoost V3 Simulation Forecast
const mockCatBoostV3Forecast = {
  product_id: 1,
  product_name: 'Wireless Mouse',
  status: 'SUCCESS',
  model_status: 'EXPERIMENTAL_UNVALIDATED',
  forecast_method: 'CATBOOST_V3_EXPERIMENTAL',
  forecast_generated_at: '2026-10-22T10:00:00Z',
  history_cutoff_date: '2026-10-21',
  forecast_start_date: '2026-10-22',
  history_days_available: 35,
  history_days_required: 28,
  horizon_days: 7,
  forecasts: [
    { date: '2026-10-22', predicted_units: 8.2 },
    { date: '2026-10-23', predicted_units: 8.9 },
    { date: '2026-10-24', predicted_units: 7.5 },
    { date: '2026-10-25', predicted_units: 8.0 },
    { date: '2026-10-26', predicted_units: 7.1 },
    { date: '2026-10-27', predicted_units: 7.4 },
    { date: '2026-10-28', predicted_units: 8.3 },
  ],
  restock_recommendation: {
    current_stock: 15,
    days_of_stock_remaining: 1.9,
    recommended_reorder_qty: 44,
    reorder_urgency: 'CRITICAL',
  },
  warnings: [
    'EXPERIMENTAL FORECAST (CATBOOST V3): Model features are causal but trained on synthetic benchmark data (MAE 89.32 vs SMA-28 89.84). Projections are exploratory heuristics.',
  ],
};

// Partial history moving average fallback
const mockFallbackForecast = {
  product_id: 2,
  product_name: 'Mechanical Keyboard',
  status: 'PARTIAL_HISTORY',
  model_status: 'BASELINE_HEURISTIC',
  forecast_method: 'FALLBACK_MOVING_AVERAGE',
  forecast_generated_at: '2026-10-22T10:00:00Z',
  history_cutoff_date: '2026-10-21',
  forecast_start_date: '2026-10-22',
  history_days_available: 12,
  history_days_required: 28,
  horizon_days: 7,
  forecasts: [
    { date: '2026-10-22', predicted_units: 3.0 },
    { date: '2026-10-23', predicted_units: 3.0 },
    { date: '2026-10-24', predicted_units: 3.0 },
    { date: '2026-10-25', predicted_units: 3.0 },
    { date: '2026-10-26', predicted_units: 3.0 },
    { date: '2026-10-27', predicted_units: 3.0 },
    { date: '2026-10-28', predicted_units: 3.0 },
  ],
  restock_recommendation: {
    current_stock: 3,
    days_of_stock_remaining: 1.0,
    recommended_reorder_qty: 28,
    reorder_urgency: 'CRITICAL',
  },
  warnings: [
    'Product has only 12 days of history (28 required). Used baseline moving average fallback.',
  ],
};

// Zero sales history
const mockInsufficientForecast = {
  product_id: 1,
  product_name: 'New Product',
  status: 'INSUFFICIENT_HISTORY',
  model_status: 'NONE',
  forecast_method: 'NONE',
  forecast_generated_at: '2026-10-22T10:00:00Z',
  history_cutoff_date: '2026-10-21',
  forecast_start_date: '2026-10-22',
  history_days_available: 0,
  history_days_required: 28,
  horizon_days: 7,
  forecasts: [],
  restock_recommendation: {
    current_stock: 0,
    days_of_stock_remaining: null,
    recommended_reorder_qty: 5,
    reorder_urgency: 'CRITICAL',
  },
  warnings: ['Product has 0 days of sales history. At least 28 continuous days required.'],
};

describe('ForecastingPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({ data: mockProducts });
    client.post.mockResolvedValue({ data: mockSma28Forecast });
  });

  it('renders page header and product selector dropdown', async () => {
    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Demand Forecasting')).toBeInTheDocument();
    expect(screen.getByText('SIMULATION ONLY')).toBeInTheDocument();

    await waitFor(() => {
      expect(client.get).toHaveBeenCalledWith('/products/?skip=0&limit=100');
    });

    expect(screen.getByText(/Choose a product/i)).toBeInTheDocument();
    expect(screen.getByText(/Select a Product to Begin Forecasting/i)).toBeInTheDocument();
  });

  it('triggers default SMA-28 baseline forecast and renders BASELINE_HEURISTIC banner', async () => {
    client.post.mockResolvedValueOnce({ data: mockSma28Forecast });

    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wireless Mouse/i)).toBeInTheDocument();
    });

    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/forecast/demand', {
        product_id: 1,
        horizon_days: 7,
        holiday_flag: 0,
        discount_pct: 0,
        model_preference: 'BASELINE_SMA28',
      });
    });

    // Verify Baseline Banner
    await waitFor(() => {
      expect(screen.getByTestId('baseline-fallback-banner')).toBeInTheDocument();
      expect(screen.getByText('SMA_28_BASELINE')).toBeInTheDocument();
      expect(screen.getByText(/Baseline 28-Day Simple Moving Average Applied/i)).toBeInTheDocument();
    });

    // Verify Metric Cards
    expect(screen.getByTestId('forecast-metrics')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // current stock
    expect(screen.getByText('CRITICAL')).toBeInTheDocument(); // urgency badge
    expect(screen.getByText('45')).toBeInTheDocument(); // recommended reorder
    expect(screen.getByText('ADVISORY ONLY')).toBeInTheDocument();

    // Verify SVG Chart and Table
    expect(screen.getByTestId('forecast-svg-chart')).toBeInTheDocument();
    expect(screen.getByTestId('forecast-table')).toBeInTheDocument();
  });

  it('renders stockout warning banner when historical stockouts occurred', async () => {
    client.post.mockResolvedValueOnce({
      data: {
        ...mockSma28Forecast,
        stockout_days_detected: 4,
      },
    });

    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wireless Mouse/i)).toBeInTheDocument();
    });

    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByTestId('stockout-warning-banner')).toBeInTheDocument();
      expect(screen.getByText(/Historical Stockout Censoring Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/4 STOCKOUT DAYS/i)).toBeInTheDocument();
    });
  });

  it('renders EXPERIMENTAL_UNVALIDATED warning banner when selecting CatBoost V3 model', async () => {
    client.post.mockResolvedValue({ data: mockCatBoostV3Forecast });

    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wireless Mouse/i)).toBeInTheDocument();
    });

    // Select Product
    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '1' } });

    // Switch Model to CatBoost V3
    const modelSelect = screen.getByLabelText(/Forecasting Model/i);
    fireEvent.change(modelSelect, { target: { value: 'CATBOOST_V3_EXPERIMENTAL' } });

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/forecast/demand', {
        product_id: 1,
        horizon_days: 7,
        holiday_flag: 0,
        discount_pct: 0,
        model_preference: 'CATBOOST_V3_EXPERIMENTAL',
      });
    });

    // Verify Prominent Experimental Warning Banner for V3
    await waitFor(() => {
      expect(screen.getByTestId('experimental-warning-banner')).toBeInTheDocument();
      expect(screen.getByText(/EXPERIMENTAL RESEARCH SIMULATION/i)).toBeInTheDocument();
      expect(screen.getByText(/CATBOOST_V3_EXPERIMENTAL/i)).toBeInTheDocument();
      expect(screen.getByText(/must not be used for automated purchase decisions/i)).toBeInTheDocument();
    });
  });

  it('renders fallback banner when product has partial history (< 28 days)', async () => {
    client.post.mockResolvedValueOnce({ data: mockFallbackForecast });

    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Mechanical Keyboard/i)).toBeInTheDocument();
    });

    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getByTestId('baseline-fallback-banner')).toBeInTheDocument();
      expect(screen.getByText('FALLBACK_MOVING_AVERAGE')).toBeInTheDocument();
      expect(screen.getByText(/simple moving average baseline/i)).toBeInTheDocument();
    });
  });

  it('renders insufficient history state cleanly without throwing', async () => {
    client.post.mockResolvedValueOnce({ data: mockInsufficientForecast });

    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wireless Mouse/i)).toBeInTheDocument();
    });

    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByTestId('insufficient-history-banner')).toBeInTheDocument();
      expect(screen.getByText(/Insufficient Sales History for Forecasting/i)).toBeInTheDocument();
    });

    // Chart should show no forecast data message
    expect(screen.getByText(/No forecast data available to render chart/i)).toBeInTheDocument();
  });

  it('updates forecast parameters when changing horizon, promotion, and discount', async () => {
    client.post.mockResolvedValue({ data: mockSma28Forecast });

    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wireless Mouse/i)).toBeInTheDocument();
    });

    // 1. Select product
    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/forecast/demand', {
        product_id: 1,
        horizon_days: 7,
        holiday_flag: 0,
        discount_pct: 0,
        model_preference: 'BASELINE_SMA28',
      });
    });

    // 2. Change horizon to 30 Days
    const horizon30Btn = screen.getByText('30 Days');
    fireEvent.click(horizon30Btn);

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/forecast/demand', {
        product_id: 1,
        horizon_days: 30,
        holiday_flag: 0,
        discount_pct: 0,
        model_preference: 'BASELINE_SMA28',
      });
    });

    // 3. Open scenario parameters
    const scenarioToggle = screen.getByText(/Simulation Scenario Parameters/i);
    fireEvent.click(scenarioToggle);

    // 4. Toggle holiday checkbox
    const holidayCheckbox = screen.getByLabelText(/Holiday \/ Promotional Event Active/i);
    fireEvent.click(holidayCheckbox);

    // 5. Change discount input
    const discountInput = screen.getByLabelText(/Planned Discount \(%\):/i);
    fireEvent.change(discountInput, { target: { value: '15' } });

    // 6. Click generate button
    const generateBtn = screen.getByRole('button', { name: /^Generate/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/forecast/demand', {
        product_id: 1,
        horizon_days: 30,
        holiday_flag: 1,
        discount_pct: 15,
        model_preference: 'BASELINE_SMA28',
      });
    });
  });

  it('auto-triggers forecast when product_id is provided in URL search params (deep-linking)', async () => {
    client.post.mockResolvedValueOnce({ data: mockSma28Forecast });

    render(
      <MemoryRouter initialEntries={['/forecasting?product_id=1']}>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/forecast/demand', {
        product_id: 1,
        horizon_days: 7,
        holiday_flag: 0,
        discount_pct: 0,
        model_preference: 'BASELINE_SMA28',
      });
      expect(screen.getByTestId('forecast-results-section')).toBeInTheDocument();
    });
  });

  it('displays error banner with retry option on API failure', async () => {
    client.post.mockRejectedValueOnce({
      response: { data: { detail: 'Model failed to compute lags.' } },
    });

    render(
      <MemoryRouter>
        <ForecastingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wireless Mouse/i)).toBeInTheDocument();
    });

    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByTestId('forecast-error-banner')).toBeInTheDocument();
      expect(screen.getByText('Model failed to compute lags.')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('keeps restocking recommendations advisory and never submits an order automatically', async () => {
    client.post.mockResolvedValueOnce({ data: mockSma28Forecast });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ForecastingPage />} />
          <Route path="/purchases" element={<div data-testid="purchases-page">Purchases Review</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Wireless Mouse/i)).toBeInTheDocument();
    });

    const productSelect = screen.getByLabelText(/Target Inventory Product/i);
    fireEvent.change(productSelect, { target: { value: '1' } });

    const draftBtn = await screen.findByRole('button', { name: /Draft in Purchases/i });
    expect(draftBtn).toBeInTheDocument();
    fireEvent.click(draftBtn);

    expect(await screen.findByTestId('purchases-page')).toBeInTheDocument();
    // Only the forecast demand POST was sent, no purchase order mutation was dispatched
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).not.toHaveBeenCalledWith('/purchases/', expect.anything());
  });
});
