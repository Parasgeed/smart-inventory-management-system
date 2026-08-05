import { useState, useEffect } from 'react';
import client from '../api/client';

function SalesPage() {
  const [salesOrders, setSalesOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Detail drawer
  const [selectedSale, setSelectedSale] = useState(null);

  // Status Confirm Modal
  const [confirmModal, setConfirmModal] = useState({ open: false, saleId: null, newStatus: '' });

  // Creation modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    payment_method: 'UPI',
    items: [{ product_id: '', quantity: 1, unit_price: '' }]
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Pack & Ship Modals/Drawers
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packForm, setPackForm] = useState({ package_number: '' });
  
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [shipForm, setShipForm] = useState({ tracking_number: '', courier: '' });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [salesRes, prodRes, custRes] = await Promise.all([
        client.get('/sales-orders/'),
        client.get('/products/?limit=100'),
        client.get('/customers/')
      ]);
      setSalesOrders(salesRes.data);
      setProducts(prodRes.data.items || prodRes.data);
      setCustomers(custRes.data.items || custRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch sales data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRowClick = (sale) => {
    setSelectedSale(sale);
  };

  const getCustomerName = (id) => {
    if (!id) return 'Walk-in Customer';
    return customers.find(c => c.id === id)?.name || `Customer #${id}`;
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || `Product #${id}`;
  const getProductStock = (id) => products.find(p => p.id === id)?.quantity || 0;

  // Line additions in creation
  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, unit_price: '' }]
    }));
  };

  const removeLineItem = (index) => {
    if (form.items.length === 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

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

  const getFormTotal = () => {
    return form.items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const getOversellWarning = (item) => {
    if (!item.product_id) return null;
    const available = getProductStock(Number(item.product_id));
    const requested = Number(item.quantity) || 0;
    if (requested > available) {
      return `Warning: Stock is ${available}. Creating a DRAFT is allowed, but shipping will fail.`;
    }
    return null;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const invalidItem = form.items.find(item => !item.product_id || Number(item.quantity) <= 0 || Number(item.unit_price) < 0);
    if (invalidItem) {
      setFormError('Please ensure all line items have a product, quantity greater than 0, and a non-negative price.');
      setSubmitting(false);
      return;
    }

    const payload = {
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      payment_method: form.payment_method,
      items: form.items.map(item => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
    };

    try {
      await client.post('/sales-orders/', payload);
      setCreateModalOpen(false);
      setForm({
        customer_id: '',
        payment_method: 'UPI',
        items: [{ product_id: '', quantity: 1, unit_price: '' }]
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to register sales order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePackSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post(`/sales-orders/${selectedSale.id}/pack`, packForm);
      setPackModalOpen(false);
      setPackForm({ package_number: '' });
      setSelectedSale(null); // close drawer to refresh data cleanly
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to pack order.');
    }
  };

  const handleShipSubmit = async (e) => {
    e.preventDefault();
    const pkg = selectedSale.packages?.[0];
    if (!pkg) return alert('No package found to ship.');
    try {
      await client.post(`/sales-orders/packages/${pkg.id}/ship`, shipForm);
      setShipModalOpen(false);
      setShipForm({ tracking_number: '', courier: '' });
      setSelectedSale(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to ship order.');
    }
  };

  const updateSalesStatus = (saleId, newStatus) => {
    setConfirmModal({ open: true, saleId, newStatus });
  };

  const handleConfirmAction = async () => {
    const { saleId, newStatus } = confirmModal;
    try {
      const response = await client.patch(`/sales-orders/${saleId}/status`, { status: newStatus });
      setSelectedSale(response.data);
      fetchData();
      setConfirmModal({ open: false, saleId: null, newStatus: '' });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to update sales status.');
    }
  };

  const getSaleProfitMetrics = (sale) => {
    let totalCost = 0;
    (sale.sales_order_items || []).forEach(item => {
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

  const filteredSales = salesOrders.filter(s => {
    const cName = getCustomerName(s.customer_id).toLowerCase();
    const matchesSearch = cName.includes(search.toLowerCase()) || 
                          (s.payment_method && s.payment_method.toLowerCase().includes(search.toLowerCase())) ||
                          s.id.toString().includes(search);
    const matchesPayment = selectedPayment ? s.payment_method === selectedPayment : true;
    const matchesStatus = selectedStatus ? s.status === selectedStatus : true;
    return matchesSearch && matchesPayment && matchesStatus;
  });

  const StatusBadge = ({ status }) => {
    const colors = {
      DRAFT: 'bg-shade-30 text-ink',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      PACKED: 'bg-yellow-100 text-yellow-800',
      SHIPPED: 'bg-aloe-10 text-ink',
      DELIVERED: 'bg-pistachio-10 text-ink',
      CANCELLED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-green-200 text-green-900',
    };
    const color = colors[status] || colors.DRAFT;
    return <span className={`px-3 py-1 rounded-pill text-eyebrow-cap font-semibold ${color}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Sales Orders</h2>
          <p className="text-caption text-shade-50">Manage the order-to-cash workflow from draft to fulfilled shipment.</p>
        </div>
        <button 
          onClick={() => setCreateModalOpen(true)}
          className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors duration-200 cursor-pointer"
        >
          New Order
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1">
        
        {/* Sales Table Card */}
        <div className="bg-canvas-light rounded-lg border border-hairline-light p-6 shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Search by Order ID, customer, payment type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-grow px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md placeholder-shade-40 focus:outline-none focus:ring-1 focus:ring-ink"
            />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink min-w-[140px]"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PACKED">PACKED</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink min-w-[140px]"
            >
              <option value="">All Payments</option>
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
              <p className="text-body-lg font-semibold">No sales orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Status</th>
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
                        <td className="py-4 px-4 font-mono font-semibold text-ink">SO-{sale.id.toString().padStart(5, '0')}</td>
                        <td className="py-4 px-4 font-medium">{getCustomerName(sale.customer_id)}</td>
                        <td className="py-4 px-4"><StatusBadge status={sale.status} /></td>
                        <td className="py-4 px-4 text-shade-60">{new Date(sale.sale_date).toLocaleDateString()}</td>
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
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-40">
              <div className="w-full max-w-lg bg-canvas-light h-full shadow-2xl border-l border-hairline-light p-6 overflow-y-auto animate-slideLeft">
                <div className="flex justify-between items-start border-b border-hairline-light pb-4 mb-4">
                <div>
                  <h3 className="font-display text-heading-md font-semibold text-ink">SO-{selectedSale.id.toString().padStart(5, '0')}</h3>
                  <p className="text-micro text-shade-50 font-mono mt-0.5">Authorized by User #{selectedSale.user_id}</p>
                </div>
                <button 
                  onClick={() => setSelectedSale(null)}
                  className="p-1 rounded-full hover:bg-shade-30 text-shade-60 hover:text-ink cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Status Timeline */}
              <div className="mb-6 px-2 py-4 bg-canvas-cream/30 rounded border border-hairline-light text-center relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10 max-w-[80%] mx-auto">
                  <div className={`flex flex-col items-center gap-1 ${['DRAFT', 'PACKED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'text-ink' : 'text-shade-40'}`}>
                    <div className={`w-4 h-4 rounded-full ${['DRAFT', 'PACKED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'bg-primary' : 'bg-shade-30'}`} />
                    <span className="text-micro font-semibold">Draft</span>
                  </div>
                  <div className={`flex-grow border-t-2 mx-2 ${['PACKED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'border-primary' : 'border-shade-30'}`}></div>
                  <div className={`flex flex-col items-center gap-1 ${['PACKED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'text-ink' : 'text-shade-40'}`}>
                    <div className={`w-4 h-4 rounded-full ${['PACKED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'bg-yellow-500' : 'bg-shade-30'}`} />
                    <span className="text-micro font-semibold">Packed</span>
                  </div>
                  <div className={`flex-grow border-t-2 mx-2 ${['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'border-aloe-10' : 'border-shade-30'}`}></div>
                  <div className={`flex flex-col items-center gap-1 ${['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'text-ink' : 'text-shade-40'}`}>
                    <div className={`w-4 h-4 rounded-full ${['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedSale.status) ? 'bg-aloe-10' : 'bg-shade-30'}`} />
                    <span className="text-micro font-semibold">Shipped</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-body-md text-ink">
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Customer</span>
                  <span className="font-semibold text-body-lg">{getCustomerName(selectedSale.customer_id)}</span>
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
                    {(selectedSale.sales_order_items || []).map(item => {
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
                            <span>₹{Number(item.unit_price).toFixed(2)} × {item.quantity}</span>
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
                    <span className="text-caption text-shade-50 font-semibold">Estimated Profit</span>
                    <span className="font-mono font-semibold text-ink">₹{metrics.profit.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-hairline-light flex flex-col gap-3">
                  {(selectedSale.status === 'DRAFT' || selectedSale.status === 'CONFIRMED') && (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setPackModalOpen(true)}
                        className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-ink font-semibold rounded-pill transition-colors cursor-pointer"
                      >
                        Pack Order
                      </button>
                      <button 
                        onClick={() => updateSalesStatus(selectedSale.id, 'CANCELLED')}
                        className="flex-1 py-3 bg-red-100 hover:bg-red-200 text-red-800 font-semibold rounded-pill transition-colors cursor-pointer"
                      >
                        Cancel Order
                      </button>
                    </div>
                  )}
                  {selectedSale.status === 'PACKED' && (
                    <button 
                      onClick={() => setShipModalOpen(true)}
                      className="w-full py-3 bg-aloe-10 hover:bg-pistachio-10 text-ink font-semibold rounded-pill transition-colors cursor-pointer"
                    >
                      Ship Order (Deduct Stock)
                    </button>
                  )}
                  {selectedSale.status === 'SHIPPED' && !selectedSale.invoice && (
                    <button 
                      onClick={async () => {
                        try {
                          const res = await client.post('/invoices/', { sales_order_id: selectedSale.id });
                          window.location.href = `/invoices/${res.data.id}`;
                        } catch (err) {
                          alert(err.response?.data?.detail || 'Failed to generate invoice');
                        }
                      }}
                      className="w-full py-3 bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold rounded-pill transition-colors cursor-pointer border border-blue-300"
                    >
                      Generate Invoice
                    </button>
                  )}
                  {selectedSale.invoice && (
                    <a 
                      href={`/invoices/${selectedSale.invoice.id}`}
                      className="w-full py-3 bg-shade-10 hover:bg-shade-20 text-ink font-semibold rounded-pill transition-colors cursor-pointer text-center block border border-shade-30"
                    >
                      View Invoice ({selectedSale.invoice.status})
                    </a>
                  )}
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
              <h3 className="font-display text-heading-md font-semibold text-ink">Create Sales Order</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-shade-60 hover:text-ink font-semibold cursor-pointer">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{formError}</div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-body-md text-ink">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Customer (Optional)</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm(prev => ({ ...prev, customer_id: e.target.value }))}
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                  >
                    <option value="">Walk-in / None</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
                    ))}
                  </select>
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
                                <option key={p.id} value={p.id}>
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
                          <div className="text-xs text-yellow-600 font-semibold pt-1">{warning}</div>
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
                  {submitting ? 'Creating...' : 'Create Draft Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pack Drawer / Modal */}
      {packModalOpen && selectedSale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-full max-w-md bg-canvas-light h-full border-l border-hairline-light shadow-2xl p-6 flex flex-col animate-slideLeft">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4 mb-6">
              <h3 className="font-display text-heading-md font-semibold text-ink">Pack Order</h3>
              <button onClick={() => setPackModalOpen(false)} className="text-shade-60 hover:text-ink cursor-pointer">✕</button>
            </div>
            
            <p className="text-body-md text-shade-60 mb-6">
              Create a package for order <span className="font-semibold">SO-{selectedSale.id}</span>.
            </p>

            <form onSubmit={handlePackSubmit} className="space-y-6 flex-grow">
              <div className="space-y-2">
                <label className="text-caption font-semibold">Package Number *</label>
                <input
                  type="text"
                  required
                  placeholder="PKG-001"
                  value={packForm.package_number}
                  onChange={(e) => setPackForm({ package_number: e.target.value })}
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setPackModalOpen(false)} className="flex-1 py-2 border border-hairline-light rounded-pill text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-yellow-400 hover:bg-yellow-500 text-ink rounded-pill font-semibold cursor-pointer">
                  Confirm Packing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ship Drawer / Modal */}
      {shipModalOpen && selectedSale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-full max-w-md bg-canvas-light h-full border-l border-hairline-light shadow-2xl p-6 flex flex-col animate-slideLeft">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4 mb-6">
              <h3 className="font-display text-heading-md font-semibold text-ink">Ship Order</h3>
              <button onClick={() => setShipModalOpen(false)} className="text-shade-60 hover:text-ink cursor-pointer">✕</button>
            </div>
            
            <div className="p-4 bg-aloe-10 text-ink rounded-lg mb-6 border border-pistachio-10">
              <p className="text-body-sm font-semibold">Notice: Action Required</p>
              <p className="text-caption mt-1">Shipping this package will permanently deduct physical stock from inventory.</p>
            </div>

            <form onSubmit={handleShipSubmit} className="space-y-4 flex-grow">
              <div className="space-y-2">
                <label className="text-caption font-semibold">Courier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="FedEx, Delhivery..."
                  value={shipForm.courier}
                  onChange={(e) => setShipForm(prev => ({ ...prev, courier: e.target.value }))}
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
              <div className="space-y-2">
                <label className="text-caption font-semibold">Tracking Number *</label>
                <input
                  type="text"
                  required
                  placeholder="TRK-987654321"
                  value={shipForm.tracking_number}
                  onChange={(e) => setShipForm(prev => ({ ...prev, tracking_number: e.target.value }))}
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShipModalOpen(false)} className="flex-1 py-2 border border-hairline-light rounded-pill text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-pill font-semibold cursor-pointer">
                  Dispatch & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-xl space-y-6">
            <h3 className="font-display text-heading-md font-semibold text-ink">Confirm Action</h3>
            <p className="text-body-md text-shade-60">Are you sure you want to mark this order as <strong className="text-ink">{confirmModal.newStatus}</strong>?</p>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setConfirmModal({ open: false, saleId: null, newStatus: '' })} className="px-4 py-2 rounded-full border border-hairline-light text-ink hover:bg-canvas-cream/50 cursor-pointer">Keep Order</button>
              <button onClick={handleConfirmAction} className={`px-4 py-2 rounded-full font-semibold cursor-pointer text-white ${confirmModal.newStatus === 'CANCELLED' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-shade-70'}`}>Yes, Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesPage;
