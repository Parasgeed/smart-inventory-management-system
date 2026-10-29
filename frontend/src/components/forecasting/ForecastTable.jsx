// frontend/src/components/forecasting/ForecastTable.jsx

export default function ForecastTable({
  forecasts = [],
  product = null,
  horizonDays = 7,
}) {
  if (!forecasts || forecasts.length === 0) return null;

  // Calculate cumulative units
  let runningSum = 0;
  const rows = forecasts.map((item) => {
    const units = Number(item.predicted_units) || 0;
    runningSum += units;
    let dayOfWeek = '';
    try {
      const d = new Date(item.date + 'T00:00:00');
      dayOfWeek = d.toLocaleDateString(undefined, { weekday: 'long' });
    } catch {
      dayOfWeek = '—';
    }

    return {
      date: item.date,
      dayOfWeek,
      predictedUnits: units,
      cumulativeUnits: runningSum,
    };
  });

  const handleExportCsv = () => {
    const headers = ['Date', 'Day of Week', 'Predicted Units', 'Cumulative Units'];
    const csvLines = [headers.join(',')];

    rows.forEach((r) => {
      csvLines.push(
        [
          `"${r.date}"`,
          `"${r.dayOfWeek}"`,
          r.predictedUnits.toFixed(2),
          r.cumulativeUnits.toFixed(2),
        ].join(',')
      );
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvLines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    const identifier = product?.sku || product?.id || 'product';
    link.setAttribute('download', `forecast_${identifier}_${horizonDays}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]"
      data-testid="forecast-table"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="font-display text-heading-md font-semibold text-ink">
            Daily Forecast Breakdown
          </h3>
          <p className="text-caption text-shade-50">
            Day-by-day projected unit consumption and cumulative requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-canvas-cream hover:bg-zinc-200 border border-hairline-light rounded text-caption font-semibold text-ink transition-colors cursor-pointer"
          data-testid="export-csv-button"
        >
          <svg className="w-4 h-4 text-shade-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span>Export CSV</span>
        </button>
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto border border-hairline-light rounded-md">
        <table className="w-full text-left border-collapse">
          <thead className="bg-canvas-cream/60 sticky top-0 z-10 border-b border-hairline-light">
            <tr className="text-caption font-semibold text-shade-60">
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4">Day of Week</th>
              <th className="py-2.5 px-4 text-right">Predicted Demand</th>
              <th className="py-2.5 px-4 text-right">Cumulative Demand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline-light text-body-md text-ink">
            {rows.map((row) => (
              <tr key={row.date} className="hover:bg-canvas-cream/30 transition-colors">
                <td className="py-2.5 px-4 font-mono text-body-md text-ink">{row.date}</td>
                <td className="py-2.5 px-4 text-shade-60 text-caption">{row.dayOfWeek}</td>
                <td className="py-2.5 px-4 text-right font-mono font-medium text-ink">
                  {row.predictedUnits.toFixed(2)}{' '}
                  <span className="text-micro text-shade-40">units</span>
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-shade-70">
                  {row.cumulativeUnits.toFixed(2)}{' '}
                  <span className="text-micro text-shade-40">units</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
