// frontend/src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [outOfStock, setOutOfStock] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [topSelling, setTopSelling] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Configurable dead stock threshold
  const [deadStockDays, setDeadStockDays] = useState(30);

  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, [deadStockDays]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        sumRes,
        actRes,
        lowRes,
        outRes,
        deadRes,
        topRes,
        monthlyRes,
        catRes
      ] = await Promise.all([
        client.get('/dashboard/summary'),
        client.get('/dashboard/activity?limit=6'),
        client.get('/dashboard/low-stock'),
        client.get('/dashboard/out-of-stock'),
        client.get(`/dashboard/dead-stock?days=${deadStockDays}`),
        client.get('/dashboard/top-selling-products?limit=5'),
        client.get('/dashboard/monthly-sales?months=6'),
        client.get('/dashboard/category-distribution')
      ]);

      setSummary(sumRes.data);
      setActivities(actRes.data);
      setLowStock(lowRes.data);
      setOutOfStock(outRes.data);
      setDeadStock(deadRes.data);
      setTopSelling(topRes.data);
      setMonthlySales(monthlyRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Error connecting to analytics database.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <svg className="animate-spin h-10 w-10 text-shade-60" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-16 text-red-500 font-medium">{error}</div>;
  }

  // Calculate total category items for distribution display
  const totalCategoryProducts = categories.reduce((sum, item) => sum + item.product_count, 0) || 1;

  // Custom Monthly Chart Max Value to scale heights
  const maxMonthlySales = Math.max(...monthlySales.map(m => Number(m.total_amount)), 1000);

  return (
    <div className="space-y-8 font-sans">
      
      {/* Title */}
      <div>
        <h2 className="text-display-md font-display font-light text-ink tracking-tight">Overview</h2>
        <p className="text-caption text-shade-50">Real-time performance metrics, inventory health, and revenue indicators.</p>
      </div>

      {/* KPI Cards: Level 3 Soft Shadow from Design.md */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_4px_4px_rgba(0,0,0,0.03),_0_2px_2px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300 overflow-hidden">
          <span className="text-caption text-shade-50 font-semibold block truncate">Inventory Net Value</span>
          <span className="text-xl lg:text-2xl xl:text-3xl font-display font-light text-ink block mt-2 font-mono truncate" title={`₹${Number(summary?.total_inventory_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>₹{Number(summary?.total_inventory_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-micro text-shade-40 block mt-1 truncate">Valued across {summary?.total_products} items</span>
        </div>

        <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_4px_4px_rgba(0,0,0,0.03),_0_2px_2px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300 overflow-hidden">
          <span className="text-caption text-shade-50 font-semibold block truncate">Today's Sales Revenue</span>
          <span className="text-xl lg:text-2xl xl:text-3xl font-display font-light text-green-700 block mt-2 font-mono truncate" title={`₹${Number(summary?.today_sales_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>₹{Number(summary?.today_sales_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-micro text-shade-40 block mt-1 truncate">{summary?.today_sales_count} invoices cleared today</span>
        </div>

        <div 
          onClick={() => navigate('/products?status=low')}
          className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_4px_4px_rgba(0,0,0,0.03),_0_2px_2px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300 cursor-pointer hover:border-pistachio-60"
        >
          <span className="text-caption text-shade-50 font-semibold block">Low Stock Alerts</span>
          <span className="text-3xl font-display font-light text-ink block mt-2 font-mono">{summary?.low_stock_count}</span>
          {summary?.low_stock_count > 0 ? (
            <span className="inline-block px-2 py-0.5 mt-1 text-[11px] font-semibold bg-pistachio-10 text-ink rounded-full">Requires attention</span>
          ) : (
            <span className="text-micro text-green-700 block mt-1">All stocks healthy</span>
          )}
        </div>

        <div 
          onClick={() => navigate('/products?status=out')}
          className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.03),_0_4px_4px_rgba(0,0,0,0.03),_0_2px_2px_rgba(0,0,0,0.03),_0_0_0_1px_rgba(0,0,0,0.03)] hover:translate-y-[-2px] transition-all duration-300 cursor-pointer hover:border-red-300"
        >
          <span className="text-caption text-shade-50 font-semibold block">Out of Stock Items</span>
          <span className="text-3xl font-display font-light text-ink block mt-2 font-mono">{outOfStock.length}</span>
          {outOfStock.length > 0 ? (
            <span className="inline-block px-2 py-0.5 mt-1 text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100 rounded-full">Reorder critical</span>
          ) : (
            <span className="text-micro text-green-700 block mt-1">No empty bins</span>
          )}
        </div>
      </div>

      {/* Critical Stock Alerts Banners */}
      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light grid grid-cols-1 md:grid-cols-2 gap-6 shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
          {outOfStock.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-caption font-bold text-red-600 flex items-center">
                <span className="mr-2">🚨</span> CRITICAL: OUT OF STOCK ({outOfStock.length})
              </h4>
              <div className="divide-y divide-hairline-light max-h-40 overflow-y-auto pr-1">
                {outOfStock.slice(0, 4).map(p => (
                  <div key={p.id} className="py-2 text-sm flex justify-between">
                    <span className="font-semibold">{p.name}</span>
                    <span className="font-mono text-shade-50">{p.sku}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-caption font-bold text-ink flex items-center">
                <span className="mr-2">⚠️</span> REORDER ALERT: LOW STOCK ({lowStock.length})
              </h4>
              <div className="divide-y divide-hairline-light max-h-40 overflow-y-auto pr-1">
                {lowStock.slice(0, 4).map(p => (
                  <div key={p.id} className="py-2 text-sm flex justify-between items-center">
                    <div>
                      <span className="font-semibold block">{p.name}</span>
                      <span className="text-micro text-shade-50">Limit: {p.reorder_level}</span>
                    </div>
                    <span className="font-mono font-semibold bg-pistachio-10 text-ink px-2 py-0.5 rounded-full text-xs">Stock: {p.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        
        {/* Left Hand: Custom Charts / Top Products */}
        <div className="space-y-6">
          
          {/* Monthly Revenue Bar Chart (Shopify UI styled) */}
          <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
            <h3 className="font-display text-heading-md font-semibold text-ink mb-6">Monthly Sales Revenue</h3>
            
            <div className="h-64 flex items-end justify-around border-b border-hairline-light pb-4">
              {monthlySales.map(m => {
                const heightPercent = (Number(m.total_amount) / maxMonthlySales) * 100;
                return (
                  <div key={m.month} className="flex flex-col items-center group relative w-12">
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-ink text-on-primary text-micro rounded py-1 px-2 font-mono z-10 shadow-lg whitespace-nowrap">
                      ₹{Number(m.total_amount).toFixed(2)} ({m.count} bills)
                    </div>
                    
                    {/* Chart Bar */}
                    <div 
                      style={{ height: `${Math.max(heightPercent, 3)}%` }} 
                      className="w-8 bg-aloe-10 rounded-t-sm group-hover:bg-primary transition-all duration-200"
                    />
                    
                    <span className="text-micro text-shade-50 mt-2 font-mono whitespace-nowrap rotate-[-15deg] sm:rotate-0">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Selling Products List */}
          <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
            <h3 className="font-display text-heading-md font-semibold text-ink mb-4">Top-Selling Products</h3>
            {topSelling.length === 0 ? (
              <p className="text-caption text-shade-50 py-4 text-center">No sales registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60">
                      <th className="py-2">Product Name</th>
                      <th className="py-2 text-right">Units Sold</th>
                      <th className="py-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                    {topSelling.map(p => (
                      <tr key={p.product_id} className="hover:bg-canvas-cream/20">
                        <td className="py-3 font-semibold text-ink">{p.product_name}</td>
                        <td className="py-3 text-right font-mono font-medium">{p.total_quantity_sold}</td>
                        <td className="py-3 text-right font-mono font-semibold text-green-700">₹{Number(p.total_revenue).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Category Distribution progress bars */}
          <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
            <h3 className="font-display text-heading-md font-semibold text-ink mb-4">Category Allocations</h3>
            <div className="space-y-4">
              {categories.map(cat => {
                const percentage = Math.round((cat.product_count / totalCategoryProducts) * 100) || 0;
                return (
                  <div key={cat.category_id} className="space-y-1 text-sm">
                    <div className="flex justify-between font-semibold">
                      <span>{cat.category_name}</span>
                      <span className="text-shade-50 font-mono">{cat.product_count} items ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-shade-30 h-2 rounded-full overflow-hidden">
                      <div style={{ width: `${percentage}%` }} className="bg-primary h-full rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Hand: Activity Feed & Dead Stock Alert */}
        <div className="space-y-6 col-span-1">
          
          {/* Recent Activities */}
          <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
            <h3 className="font-display text-heading-md font-semibold text-ink mb-4">Recent Operations</h3>
            {activities.length === 0 ? (
              <p className="text-caption text-shade-50 py-4 text-center">No recent purchases or sales logged.</p>
            ) : (
              <div className="space-y-4">
                {activities.map((act, index) => {
                  const isSale = act.type === 'sale';
                  return (
                    <div key={index} className="flex items-start space-x-3 text-sm">
                      <div className={`p-2 rounded-full font-bold ${isSale ? 'bg-green-50 text-green-700' : 'bg-pistachio-10 text-ink'}`}>
                        {isSale ? '🛒' : '📦'}
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-ink">
                            {isSale ? `Sale: ${act.reference}` : `Purchased from: ${act.reference}`}
                          </span>
                          <span className={`font-mono font-semibold ${isSale ? 'text-green-700' : 'text-ink'}`}>
                            {isSale ? '+' : '-'}₹{Number(act.amount).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-micro text-shade-50 mt-0.5">
                          {isSale ? 'Invoice' : 'Purchase PO'} #{act.id} • {new Date(act.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dead Stock warning cards */}
          <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-heading-md font-semibold text-ink">Dead Stock Warnings</h3>
              <select 
                value={deadStockDays} 
                onChange={(e) => setDeadStockDays(Number(e.target.value))}
                className="px-2 py-1 bg-canvas-cream border border-hairline-light rounded text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
            {deadStock.length === 0 ? (
              <p className="text-caption text-green-700 py-4 text-center">No dead stock detected in this window!</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {deadStock.slice(0, 5).map(item => (
                  <div key={item.product_id} className="p-3 bg-canvas-cream/30 rounded border border-hairline-light text-sm flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-ink block">{item.product_name}</span>
                      <span className="text-micro text-shade-50">
                        {item.days_since_last_sale !== null 
                          ? `Unsold for ${item.days_since_last_sale} days` 
                          : 'Never sold'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-ink block">Qty: {item.quantity}</span>
                      <span className="text-micro text-shade-40">Val: ₹{Number(item.stock_value).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
