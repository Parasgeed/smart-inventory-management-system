// frontend/src/components/forecasting/ForecastChart.jsx
import { useState, useId } from 'react';

export default function ForecastChart({ forecasts = [], horizonDays = 7 }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const gradientId = useId();

  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
        <h3 className="font-display text-heading-md font-semibold text-ink mb-4">
          Projected Daily Demand Trend
        </h3>
        <div className="h-64 flex flex-col items-center justify-center text-caption text-shade-50">
          <svg className="w-10 h-10 text-shade-30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>No forecast data available to render chart</span>
        </div>
      </div>
    );
  }

  // Dimensions & padding for SVG
  const width = 800;
  const height = 280;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = forecasts.map((f) => Number(f.predicted_units) || 0);
  const rawMax = Math.max(...values, 5);
  // Round up max for nice axis ticks
  const maxVal = Math.ceil(rawMax * 1.15);
  const minVal = 0;

  // Grid tick lines
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = minVal + (maxVal - minVal) * (i / tickCount);
    return {
      value: val,
      y: paddingTop + chartHeight - (i / tickCount) * chartHeight,
    };
  });

  // Calculate coordinates
  const n = forecasts.length;
  const stepX = n > 1 ? chartWidth / (n - 1) : chartWidth / 2;

  const points = forecasts.map((f, i) => {
    const val = Number(f.predicted_units) || 0;
    const x = paddingLeft + (n > 1 ? i * stepX : chartWidth / 2);
    const normalizedY = (val - minVal) / (maxVal - minVal || 1);
    const y = paddingTop + chartHeight - normalizedY * chartHeight;
    return { ...f, val, x, y, index: i };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPolygonPoints = `${paddingLeft},${paddingTop + chartHeight} ${polylinePoints} ${
    points[points.length - 1].x
  },${paddingTop + chartHeight}`;

  // Formatter for day name
  const formatDayName = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Determine label frequency to avoid crowded X axis
  const labelInterval = n <= 7 ? 1 : n <= 14 ? 2 : n <= 30 ? 4 : 10;

  return (
    <div
      className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)] relative"
      data-testid="forecast-chart-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-heading-md font-semibold text-ink">
            Projected Daily Demand Curve
          </h3>
          <p className="text-caption text-shade-50">
            Daily simulation over next {horizonDays} days. Hover over points to inspect values.
          </p>
        </div>
        <div className="flex items-center gap-4 text-micro font-mono">
          <span className="flex items-center gap-1.5 text-shade-60">
            <span className="w-3 h-0.5 bg-primary rounded-full inline-block"></span>
            Predicted Daily Units
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[550px] select-none"
          preserveAspectRatio="xMidYMid meet"
          data-testid="forecast-svg-chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines & Y Axis labels */}
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="#e4e4e7"
                strokeDasharray={idx === 0 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="text-[11px] font-mono fill-shade-40 font-medium"
              >
                {tick.value.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Area fill under curve */}
          <polygon points={areaPolygonPoints} fill={`url(#${gradientId})`} />

          {/* Polyline line curve */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#000000"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X Axis Date labels and hover circles */}
          {points.map((p, i) => {
            const showLabel = i === 0 || i === n - 1 || i % labelInterval === 0;
            const isHovered = hoveredPoint?.index === i;

            return (
              <g key={i}>
                {/* X axis tick text */}
                {showLabel && (
                  <text
                    x={p.x}
                    y={height - 12}
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-shade-50 font-medium"
                  >
                    {formatDayName(p.date)}
                  </text>
                )}

                {/* Point hit area and marker */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 3.5}
                  className={`transition-all duration-150 cursor-pointer ${
                    isHovered
                      ? 'fill-primary stroke-canvas-light stroke-2 shadow-lg'
                      : 'fill-canvas-light stroke-primary stroke-2 hover:fill-primary'
                  }`}
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Transparent larger hit target for easy hovering */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="16"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip overlay */}
        {hoveredPoint && (
          <div
            className="absolute bg-canvas-night text-on-primary text-micro rounded-md py-2 px-3 shadow-xl pointer-events-none z-30 font-mono transition-transform"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
            data-testid="chart-hover-tooltip"
          >
            <div className="font-sans font-semibold text-[11px] text-shade-30">
              {hoveredPoint.date}
            </div>
            <div className="text-body-md font-bold text-aloe-10 mt-0.5">
              {Number(hoveredPoint.predicted_units).toFixed(2)}{' '}
              <span className="text-[11px] font-normal text-on-primary">units</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
