// frontend/src/pages/SalesPage.jsx
import { useState, useEffect } from 'react';
import client from '../api/client';

function SalesPage() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');

  // Detail drawer
  const [selectedSale, setSelectedSale] = useState(null);

  // Creation modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    payment_method: 'UPI',
    items: [{ product_id: '', quantity: 1, unit_price: '' }]
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [salesRes, prodRes] = await Promise.all([
        client.get('/sales/'),
        client.get('/products/?limit=100')
      ]);
      setSales(salesRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch sales data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (sale) => {
    setSelectedSale(sale);
  };

  // Line additions in creation
  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, unit_price: '' }]
    }));
  };

  // Line removals in creation
  const removeLineItem = (index) => {
    if (form.items.length === 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  // Item modification in creation
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index][field] = value;

      // Automatically set selling price on selection
      if (field === 'product_id') {
        const prod = products.find(p => p.id === Number(value));
        if (prod) {
          newItems[index]['unit_price'] = prod.selling_price;
        }
      }
      return { ...prev, items: newItems };
    });
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || `Product #${id}`;
  const getProductStock = (id) => products.find(p => p.id === id)?.quantity || 0;

  // Calculate form totals
  const getFormTotal = () => {
    return form.items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  // Check client-side stock availability to warn before submitting
  const getOversellWarning = (item) => {
    if (!item.product_id) return null;
    const available = getProductStock(Number(item.product_id));
    const requested = Number(item.quantity) || 0;
    if (requested > available) {
      return `Insufficient stock! (Available: ${available}, Requested: ${requested})`;
    }
    return null;
  };

  // Submit sale creation
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    // Pre-validations
    const invalidItem = form.items.find(item => !item.product_id || Number(item.quantity) <= 0 || Number(item.unit_price) < 0);
    if (invalidItem) {
      setFormError('Please ensure all line items have a product, quantity greater than 0, and a non-negative price.');
      setSubmitting(false);
      return;
    }

    // Check oversell warnings client side
    let hasOversell = false;
    form.items.forEach(item => {
      if (getOversellWarning(item)) {
        hasOversell = true;
      }
    });

    if (hasOversell) {
      setFormError('Cannot create sale: one or more items exceed current stock levels.');
      setSubmitting(false);
      return;
    }

    const payload = {
      customer_name: form.customer_name || 'Walk-in Customer',
      payment_method: form.payment_method,
      items: form.items.map(item => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
    };

    try {
      await client.post('/sales/', payload);
      setCreateModalOpen(false);
      setForm({
        customer_name: '',
        payment_method: 'UPI',
        items: [{ product_id: '', quantity: 1, unit_price: '' }]
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to register sale order.');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute sale profit metrics for display
  const getSaleProfitMetrics = (sale) => {
    let totalCost = 0;
    sale.sale_items.forEach(item => {
      const costAtSale = item.cost_price_at_sale !== null 
        ? Number(item.cost_price_at_sale) 
        : (products.find(p => p.id === item.product_id)?.cost_price || 0);
      totalCost += costAtSale * item.quantity;
    });

    const revenue = Number(sale.total_amount);
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return { totalCost, profit, margin };
  };

  const filteredSales = sales.filter(s => {
    const cName = (s.customer_name || 'Walk-in Customer').toLowerCase();
    const matchesSearch = cName.includes(search.toLowerCase()) || 
                          (s.payment_method && s.payment_method.toLowerCase().includes(search.toLowerCase())) ||
                          s.id.toString().includes(search);
    const matchesPayment = selectedPayment ? s.payment_method === selectedPayment : true;
    return matchesSearch && matchesPayment;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Sales Register</h2>
          <p className="text-caption text-shade-50">Create invoices, check payment records, track transactions, and protect against stockouts.</p>
        </div>
        <button 
          onClick={() => setCreateModalOpen(true)}
          className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors duration-200 cursor-pointer"
        >
          New Sale
        </button>
      </div>

      <div className={`grid gap-6 transition-all duration-300 ${selectedSale ? 'grid-cols-1 lg:grid-cols-[1fr_400px]' : 'grid-cols-1'}`}>
        
        {/* Sales Table Card */}
        <div className="bg-canvas-light rounded-lg border border-hairline-light p-6 shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Search by Invoice ID, customer, payment type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-grow px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md placeholder-shade-40 focus:outline-none focus:ring-1 focus:ring-ink"
            />
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink min-w-[160px]"
            >
              <option value="">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="NetBanking">NetBanking</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-16">
              <svg className="animate-spin h-8 w-8 text-shade-60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500 font-medium">{error}</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-16 text-shade-50">
              <p className="text-body-lg font-semibold">No sales transactions logged</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-3 px-4">Invoice ID</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {filteredSales.map(sale => {
                    return (
                      <tr 
                        key={sale.id}
                        onClick={() => handleRowClick(sale)}
                        className={`hover:bg-canvas-cream/40 cursor-pointer transition-all duration-150 ${selectedSale?.id === sale.id ? 'bg-canvas-cream/70' : ''}`}
                      >
                        <td className="py-4 px-4 font-mono font-semibold text-ink">INV-{sale.id.toString().padStart(5, '0')}</td>
                        <td className="py-4 px-4 font-medium">{sale.customer_name || 'Walk-in Customer'}</td>
                        <td className="py-4 px-4 text-shade-60">{sale.payment_method || 'Cash'}</td>
                        <td className="py-4 px-4 text-shade-60">{new Date(sale.sale_date || sale.created_at).toLocaleDateString()}</td>
                        <td className="py-4 px-4 text-right font-mono font-semibold text-green-700">₹{Number(sale.total_amount).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sales Detail Panel */}
        {selectedSale && (() => {
          const metrics = getSaleProfitMetrics(selectedSale);
          return (
            <div className="bg-canvas-light rounded-lg border border-hairline-light p-6 shadow-[0_8px_8px_rgba(0,0,0,0.05),_0_0_0_1px_rgba(0,0,0,0.05)] h-fit animate-slideLeft">
              <div className="flex justify-between items-start border-b border-hairline-light pb-4 mb-4">
                <div>
                  <h3 className="font-display text-heading-md font-semibold text-ink">INV-{selectedSale.id.toString().padStart(5, '0')}</h3>
                  <p className="text-micro text-shade-50 font-mono mt-0.5">Authorized by User #{selectedSale.user_id}</p>
                </div>
                <button 
                  onClick={() => setSelectedSale(null)}
                  className="p-1 rounded-full hover:bg-shade-30 text-shade-60 hover:text-ink cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-body-md text-ink">
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Customer</span>
                  <span className="font-semibold text-body-lg">{selectedSale.customer_name || 'Walk-in Customer'}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-caption text-shade-50 block font-semibold">Payment Mode</span>
                    <span>{selectedSale.payment_method || 'Cash'}</span>
                  </div>
                  <div>
                    <span className="text-caption text-shade-50 block font-semibold">Time</span>
                    <span className="text-sm truncate block">{new Date(selectedSale.sale_date).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <span className="text-caption text-shade-50 block font-semibold mb-2">Sold Items</span>
                  <div className="space-y-2 border border-hairline-light rounded-md divide-y divide-hairline-light max-h-56 overflow-y-auto bg-canvas-cream/10">
                    {selectedSale.sale_items.map(item => {
                      const costAtSale = item.cost_price_at_sale !== null 
                        ? Number(item.cost_price_at_sale) 
                        : (products.find(p => p.id === item.product_id)?.cost_price || 0);
                      const markup = Number(item.unit_price) - costAtSale;
                      const itemMargin = Number(item.unit_price) > 0 ? (markup / Number(item.unit_price)) * 100 : 0;
                      
                      return (
                        <div key={item.id} className="p-3 text-sm space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-ink">{getProductName(item.product_id)}</span>
                            <span className="font-mono font-semibold text-ink">₹{Number(item.subtotal).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-micro text-shade-50">
                            <span>₹{Number(item.unit_price).toFixed(2)} × {item.quantity} (Cost: ₹{costAtSale.toFixed(2)})</span>
                            <span className="text-green-700 font-semibold">Margin: {itemMargin.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Profit/Margin Breakdown */}
                <div className="p-4 rounded-lg bg-canvas-cream/50 border border-hairline-light space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-caption text-shade-50 font-semibold">Total Revenue</span>
                    <span className="font-mono font-semibold text-green-700">₹{Number(selectedSale.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-caption text-shade-50 font-semibold">Total Cost of Goods</span>
                    <span className="font-mono font-semibold text-shade-60">₹{metrics.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-hairline-light pt-2 mt-2">
                    <span className="text-caption text-shade-50 font-semibold text-body-lg">Estimated Profit</span>
                    <span className="font-mono font-bold text-body-lg text-ink">₹{metrics.profit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-caption text-shade-50 font-semibold">Gross Profit Margin</span>
                    <span className="font-semibold text-green-700">{metrics.margin.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Record Sale Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-2xl w-full p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4">
              <h3 className="font-display text-heading-md font-semibold text-ink">Create Sales Invoice</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-shade-60 hover:text-ink font-semibold">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{formError}</div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-body-md text-ink">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={form.customer_name}
                    onChange={(e) => setForm(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Walk-in Customer"
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Payment Method *</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                  >
                    <option value="UPI">UPI Payment</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="NetBanking">Net Banking</option>
                  </select>
                </div>
              </div>

              {/* Line Items Container */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-hairline-light pb-2">
                  <span className="font-semibold text-caption text-shade-60">Line Items</span>
                  <button 
                    type="button" 
                    onClick={addLineItem} 
                    className="text-xs font-semibold text-ink hover:text-shade-60 border border-hairline-light rounded-full px-3 py-1 cursor-pointer bg-canvas-cream/10"
                  >
                    + Add Product
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {form.items.map((item, index) => {
                    const warning = getOversellWarning(item);
                    return (
                      <div key={index} className="space-y-1 bg-canvas-cream/20 p-3 rounded border border-hairline-light">
                        <div className="grid grid-cols-[1fr_80px_120px_40px] gap-3 items-end">
                          <div className="space-y-1 text-left">
                            <label className="text-xs text-shade-50 font-semibold block">Product *</label>
                            <select
                              required
                              value={item.product_id}
                              onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                              className="px-2 py-1.5 bg-canvas-light border border-hairline-light rounded w-full text-xs focus:outline-none focus:ring-1 focus:ring-ink"
                            >
                              <option value="">Select Product</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                                  {p.name} (SKU: {p.sku}, Qty: {p.quantity})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="text-xs text-shade-50 font-semibold block">Qty *</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="px-2 py-1.5 bg-canvas-light border border-hairline-light rounded w-full text-xs focus:outline-none focus:ring-1 focus:ring-ink font-mono"
                            />
                          </div>

                          <div className="space-y-1 text-left">
                            <label className="text-xs text-shade-50 font-semibold block">Unit Price (₹) *</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                              className="px-2 py-1.5 bg-canvas-light border border-hairline-light rounded w-full text-xs focus:outline-none focus:ring-1 focus:ring-ink font-mono"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            disabled={form.items.length === 1}
                            className="py-2.5 text-center text-red-500 hover:text-red-700 disabled:opacity-40 text-xs font-semibold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        {warning && (
                          <div className="text-xs text-red-600 font-semibold pt-1">{warning}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total calculations */}
              <div className="flex justify-between items-center border-t border-hairline-light pt-4 mt-6 p-4 rounded bg-canvas-cream/40">
                <span className="font-semibold text-ink">Invoice Amount</span>
                <span className="font-mono font-bold text-lg text-ink">₹{getFormTotal().toFixed(2)}</span>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer">
                  {submitting ? 'Registering Sale...' : 'Register Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesPage;
