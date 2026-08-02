// frontend/src/pages/ReportsPage.jsx
import { useState, useEffect } from 'react';
import client from '../api/client';

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales'); // sales, purchases, inventory, profit-loss, stock-valuation, audit-trail
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchReportData();
  }, [activeTab]);

  async function fetchReportData() {
    setLoading(true);
    setError('');
    setData([]);

    try {
      const params = {};
      if (startDate && ['sales', 'purchases', 'profit-loss', 'audit-trail'].includes(activeTab)) {
        params.start_date = startDate;
      }
      if (endDate && ['sales', 'purchases', 'profit-loss', 'audit-trail'].includes(activeTab)) {
        params.end_date = endDate;
      }

      const response = await client.get(`/reports/${activeTab}`, { params });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setError('Failed to generate report. Check input filters.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = {};
      if (startDate && ['sales', 'purchases', 'profit-loss', 'audit-trail'].includes(activeTab)) {
        params.start_date = startDate;
      }
      if (endDate && ['sales', 'purchases', 'profit-loss', 'audit-trail'].includes(activeTab)) {
        params.end_date = endDate;
      }

      const response = await client.get(`/reports/${activeTab}/export`, {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTab}_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV Export failed:', err);
      alert('Failed to download CSV export. Please try again.');
    }
  };

  const showDateFilters = ['sales', 'purchases', 'profit-loss', 'audit-trail'].includes(activeTab);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Reports</h2>
          <p className="text-caption text-shade-50">Generate accounting statements, profit audits, stock valuations, and historical movement ledgers.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={data.length === 0}
          className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Export CSV
        </button>
      </div>

      {/* Tabs list: Shopify Style */}
      <div className="flex border-b border-hairline-light space-x-6 overflow-x-auto pb-px">
        {[
          { id: 'sales', label: 'Sales Reports' },
          { id: 'purchases', label: 'Purchase Reports' },
          { id: 'inventory', label: 'Inventory Reports' },
          { id: 'profit-loss', label: 'Profit & Loss' },
          { id: 'stock-valuation', label: 'Stock Valuation' },
          { id: 'audit-trail', label: 'Audit Trail' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setData([]); setActiveTab(tab.id); setStartDate(''); setEndDate(''); }}
            className={`py-3 text-body-md font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-ink font-semibold' : 'border-transparent text-shade-40 hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Bar Card */}
      {showDateFilters && (
        <div className="bg-canvas-light p-4 rounded-lg border border-hairline-light flex flex-wrap items-end gap-4 shadow-[0_4px_4px_rgba(0,0,0,0.01)]">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-shade-50 block">Start Date</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-canvas-light border border-hairline-light rounded text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-shade-50 block">End Date</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-canvas-light border border-hairline-light rounded text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <button
            onClick={fetchReportData}
            className="px-6 py-2 text-xs font-semibold border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer bg-canvas-light transition-all"
          >
            Generate Report
          </button>
        </div>
      )}

      {/* Report Data Card */}
      <div className="bg-canvas-light rounded-lg border border-hairline-light p-6 shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <svg className="animate-spin h-8 w-8 text-shade-60" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 font-medium">{error}</div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-shade-50">
            <p className="text-body-lg font-semibold">No report records found</p>
            <p className="text-caption mt-1">Try expanding the date range filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Sales Report Table */}
            {activeTab === 'sales' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Invoice</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {data.map((row, index) => (
                    <tr key={index} className="hover:bg-canvas-cream/20">
                      <td className="py-3 px-3 text-shade-60">{new Date(row.sale_date).toLocaleDateString()}</td>
                      <td className="py-3 px-3 font-mono">INV-{row.sale_id.toString().padStart(5, '0')}</td>
                      <td className="py-3 px-3 font-medium">{row.customer_name}</td>
                      <td className="py-3 px-3">{row.product_name}</td>
                      <td className="py-3 px-3 text-right font-mono">{row.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono">₹{Number(row.unit_price).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-green-700">₹{Number(row.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Purchases Report Table */}
            {activeTab === 'purchases' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">PO Number</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Cost Price</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {data.map((row, index) => (
                    <tr key={index} className="hover:bg-canvas-cream/20">
                      <td className="py-3 px-3 text-shade-60">{new Date(row.purchase_date).toLocaleDateString()}</td>
                      <td className="py-3 px-3 font-mono">PO-{row.purchase_id.toString().padStart(5, '0')}</td>
                      <td className="py-3 px-3 font-medium">{row.supplier_name}</td>
                      <td className="py-3 px-3">{row.product_name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.status === 'RECEIVED' ? 'bg-aloe-10' : row.status === 'PENDING' ? 'bg-pistachio-10' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">{row.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono">₹{Number(row.unit_price).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">₹{Number(row.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Inventory Report Table */}
            {activeTab === 'inventory' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3 text-right">Stock</th>
                    <th className="py-2.5 px-3 text-right">Limit</th>
                    <th className="py-2.5 px-3 text-right">Net Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {data.map((row, index) => (
                    <tr key={index} className="hover:bg-canvas-cream/20">
                      <td className="py-3 px-3 font-semibold">{row.name}</td>
                      <td className="py-3 px-3 font-mono text-xs">{row.sku}</td>
                      <td className="py-3 px-3 text-shade-60">{row.category}</td>
                      <td className="py-3 px-3 text-shade-60 truncate max-w-[120px]">{row.supplier}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">{row.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono text-shade-50">{row.reorder_level}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">₹{Number(row.inventory_value).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Profit & Loss Report Table */}
            {activeTab === 'profit-loss' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-2.5 px-3">Invoice</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3 text-right">Cost (COGS)</th>
                    <th className="py-2.5 px-3 text-right">Profit</th>
                    <th className="py-2.5 px-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {data.map((row, index) => (
                    <tr key={index} className="hover:bg-canvas-cream/20">
                      <td className="py-3 px-3 font-mono">INV-{row.sale_id.toString().padStart(5, '0')}</td>
                      <td className="py-3 px-3 font-medium">{row.product_name}</td>
                      <td className="py-3 px-3 text-right font-mono">{row.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono text-green-700">₹{Number(row.revenue).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono text-shade-50">₹{Number(row.cost).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">₹{Number(row.profit).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-green-700">{row.margin_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Stock Valuation Table */}
            {activeTab === 'stock-valuation' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-2.5 px-3">Category Group</th>
                    <th className="py-2.5 px-3 text-right">Product Types</th>
                    <th className="py-2.5 px-3 text-right">Total Quantity</th>
                    <th className="py-2.5 px-3 text-right">Consolidated Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {data.map((row, index) => {
                    const isTotal = row.category_name === 'TOTAL';
                    return (
                      <tr key={index} className={`hover:bg-canvas-cream/20 ${isTotal ? 'bg-canvas-cream/50 font-bold border-t-2 border-primary' : ''}`}>
                        <td className="py-3 px-3">{row.category_name}</td>
                        <td className="py-3 px-3 text-right font-mono">{row.product_count}</td>
                        <td className="py-3 px-3 text-right font-mono">{row.total_quantity}</td>
                        <td className="py-3 px-3 text-right font-mono text-green-700">₹{Number(row.total_value).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Audit Trail Table */}
            {activeTab === 'audit-trail' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-center">Movement</th>
                    <th className="py-2.5 px-3 text-center">Source</th>
                    <th className="py-2.5 px-3 text-right">Prev</th>
                    <th className="py-2.5 px-3 text-right">Change</th>
                    <th className="py-2.5 px-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {data.map((row, index) => {
                    const isAddition = row.quantity_changed > 0;
                    return (
                      <tr key={index} className="hover:bg-canvas-cream/20">
                        <td className="py-3 px-3 text-shade-60 text-xs font-mono">{new Date(row.timestamp).toLocaleString()}</td>
                        <td className="py-3 px-3 font-semibold">{row.product_name}</td>
                        <td className="py-3 px-3 text-center text-xs font-bold">{row.change_type}</td>
                        <td className="py-3 px-3 text-center text-xs text-shade-50 font-mono">{row.reference_type} #{row.reference_id}</td>
                        <td className="py-3 px-3 text-right font-mono text-shade-50">{row.previous_quantity}</td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${isAddition ? 'text-green-700' : 'text-red-700'}`}>
                          {isAddition ? '+' : ''}{row.quantity_changed}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">{row.new_quantity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsPage;
