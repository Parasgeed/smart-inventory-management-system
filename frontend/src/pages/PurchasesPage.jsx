// frontend/src/pages/PurchasesPage.jsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/client';

function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Selected detail
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // Status Confirm Modal
  const [confirmModal, setConfirmModal] = useState({ open: false, purchaseId: null, newStatus: '' });

  // Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    po_number: '',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0], // Default today
    expected_delivery_date: '',
    tax_rate: '',
    discount_rate: '',
    shipping_charges: '',
    payment_terms: '',
    delivery_address: '',
    notes: '',
    items: [{ product_id: '', quantity: 1, unit_price: '' }]
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const location = useLocation();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryProductId = searchParams.get('product_id');
    const queryQty = searchParams.get('qty');

    const targetProductId = location.state?.productId || (queryProductId ? Number(queryProductId) : null);
    const targetQty = location.state?.quantity || (queryQty ? Number(queryQty) : 1);
    const isRestockAction = location.state?.action === 'restock' || Boolean(queryProductId);

    if (products.length > 0 && isRestockAction && targetProductId) {
      const prod = products.find(p => p.id === targetProductId);
      if (prod) {
        setCreateModalOpen(true);
        setForm(prev => ({
          ...prev,
          supplier_id: prod.supplier_id || '',
          items: [{ product_id: prod.id, quantity: targetQty, unit_price: prod.cost_price || 0 }]
        }));
        // Clean up location state to prevent re-opening on refresh
        window.history.replaceState({}, document.title, location.pathname);
      }
    }
  }, [location.state, location.search, products]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [purRes, supRes, prodRes] = await Promise.all([
        client.get('/purchases/'),
        client.get('/suppliers/'),
        client.get('/products/?limit=100')
      ]);
      setPurchases(purRes.data);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch purchases data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (purchase) => {
    setSelectedPurchase(purchase);
  };

  // Add Item to creation list
  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, unit_price: '' }]
    }));
  };

  // Remove Item from creation list
  const removeLineItem = (index) => {
    if (form.items.length === 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  // Change Item details
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index][field] = value;

      // Automatically set cost price when product changes
      if (field === 'product_id') {
        const prod = products.find(p => p.id === Number(value));
        if (prod) {
          newItems[index]['unit_price'] = prod.cost_price;
        }
      }
      return { ...prev, items: newItems };
    });
  };

  const updatePurchaseStatus = (purchaseId, newStatus) => {
    setConfirmModal({ open: true, purchaseId, newStatus });
  };

  const handleConfirmAction = async () => {
    const { purchaseId, newStatus } = confirmModal;
    try {
      const response = await client.patch(`/purchases/${purchaseId}/status`, { status: newStatus });
      setSelectedPurchase(response.data);
      fetchData();
      setConfirmModal({ open: false, purchaseId: null, newStatus: '' });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to update purchase status.');
    }
  };

  const handleReceivePurchase = async (purchase) => {
    try {
      const itemsToReceive = purchase.purchase_items
        .filter(item => item.remaining_quantity > 0)
        .map(item => ({
          product_id: item.product_id,
          quantity_received: item.remaining_quantity
        }));
      
      if (itemsToReceive.length === 0) return;

      const response = await client.post(`/purchases/${purchase.id}/receive`, { items: itemsToReceive });
      setSelectedPurchase(response.data);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to receive purchase items.');
    }
  };

  // Calculate total amount in form
  const getFormTotal = () => {
    const subtotal = form.items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);

    const discountRate = Number(form.discount_rate) || 0;
    const taxRate = Number(form.tax_rate) || 0;
    const shipping = Number(form.shipping_charges) || 0;

    const discountAmount = subtotal * (discountRate / 100);
    const discountedSubtotal = subtotal - discountAmount;
    const taxAmount = discountedSubtotal * (taxRate / 100);

    return discountedSubtotal + taxAmount + shipping;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    // Validations
    if (!form.po_number.trim()) {
      setFormError('Please enter a PO Number.');
      setSubmitting(false);
      return;
    }
    
    if (!form.supplier_id) {
      setFormError('Please select a supplier.');
      setSubmitting(false);
      return;
    }

    const invalidItem = form.items.find(item => !item.product_id || Number(item.quantity) <= 0 || Number(item.unit_price) < 0);
    if (invalidItem) {
      setFormError('Please ensure all line items have a product, quantity greater than 0, and a non-negative price.');
      setSubmitting(false);
      return;
    }

    const payload = {
      po_number: form.po_number.trim(),
      supplier_id: Number(form.supplier_id),
      order_date: new Date(form.order_date).toISOString(),
      expected_delivery_date: form.expected_delivery_date ? new Date(form.expected_delivery_date).toISOString() : null,
      tax_rate: form.tax_rate ? Number(form.tax_rate) : null,
      discount_rate: form.discount_rate ? Number(form.discount_rate) : null,
      shipping_charges: form.shipping_charges ? Number(form.shipping_charges) : null,
      payment_terms: form.payment_terms.trim() || null,
      delivery_address: form.delivery_address.trim() || null,
      notes: form.notes.trim() || null,
      items: form.items.map(item => ({
        product_id: Number(item.product_id),
        ordered_quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
    };

    try {
      await client.post('/purchases/', payload);
      setCreateModalOpen(false);
      setForm({
        po_number: '',
        supplier_id: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: '',
        tax_rate: '',
        discount_rate: '',
        shipping_charges: '',
        payment_terms: '',
        delivery_address: '',
        notes: '',
        items: [{ product_id: '', quantity: 1, unit_price: '' }]
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || `Supplier #${id}`;
  const getProductName = (id) => products.find(p => p.id === id)?.name || `Product #${id}`;

  const filteredPurchases = purchases.filter(p => {
    const sName = getSupplierName(p.supplier_id).toLowerCase();
    const poStr = p.po_number ? p.po_number.toLowerCase() : `po-${p.id}`;
    const matchesSearch = sName.includes(search.toLowerCase()) || 
                          (p.notes && p.notes.toLowerCase().includes(search.toLowerCase())) ||
                          poStr.includes(search.toLowerCase());
    const matchesStatus = selectedStatus ? p.status === selectedStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Purchase Orders</h2>
          <p className="text-caption text-shade-50">Create, monitor status, and manage inventory arrivals from suppliers.</p>
        </div>
        <button 
          onClick={() => setCreateModalOpen(true)}
          className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors duration-200 cursor-pointer"
        >
          New Purchase
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1">
        
        {/* Table List Card */}
        <div className="bg-canvas-light rounded-lg border border-hairline-light p-6 shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Search by PO Number, supplier, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-grow px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md placeholder-shade-40 focus:outline-none focus:ring-1 focus:ring-ink"
            />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink min-w-[160px]"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ISSUED">ISSUED</option>
              <option value="PARTIALLY_RECEIVED">PARTIALLY_RECEIVED</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="CANCELLED">CANCELLED</option>
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
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-16 text-shade-50">
              <p className="text-body-lg font-semibold">No purchase orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {filteredPurchases.map(p => {
                    return (
                      <tr 
                        key={p.id}
                        onClick={() => handleRowClick(p)}
                        className={`hover:bg-canvas-cream/40 cursor-pointer transition-all duration-150 ${selectedPurchase?.id === p.id ? 'bg-canvas-cream/70' : ''}`}
                      >
                        <td className="py-4 px-4 font-mono font-semibold text-ink">{p.po_number || `PO-${p.id.toString().padStart(5, '0')}`}</td>
                        <td className="py-4 px-4 font-medium">{getSupplierName(p.supplier_id)}</td>
                        <td className="py-4 px-4 text-shade-60">{new Date(p.order_date || p.purchase_date || p.created_at).toLocaleDateString()}</td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                            p.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            p.status === 'ISSUED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            p.status === 'PARTIALLY_RECEIVED' ? 'bg-pistachio-10 text-ink border border-pistachio-30' :
                            p.status === 'RECEIVED' ? 'bg-aloe-10 text-ink border border-aloe-30' :
                            'bg-red-50 text-red-600 border border-red-200'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-semibold">₹{Number(p.total_amount).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Purchase Detail Panel */}
        {selectedPurchase && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-40">
            <div className="w-full max-w-lg bg-canvas-light h-full shadow-2xl border-l border-hairline-light p-6 overflow-y-auto animate-slideLeft">
              <div className="flex justify-between items-start border-b border-hairline-light pb-4 mb-4">
              <div>
                <h3 className="font-display text-heading-md font-semibold text-ink">{selectedPurchase.po_number || `PO-${selectedPurchase.id.toString().padStart(5, '0')}`}</h3>
                <p className="text-micro text-shade-50 font-mono mt-0.5">Logged by User #{selectedPurchase.user_id}</p>
              </div>
              <button 
                onClick={() => setSelectedPurchase(null)}
                className="p-1 rounded-full hover:bg-shade-30 text-shade-60 hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-body-md text-ink">
              <div>
                <span className="text-caption text-shade-50 block font-semibold">Supplier</span>
                <span className="font-semibold text-body-lg">{getSupplierName(selectedPurchase.supplier_id)}</span>
              </div>

              <div>
                <span className="text-caption text-shade-50 block font-semibold">Date & Status</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-shade-60">{new Date(selectedPurchase.order_date || selectedPurchase.purchase_date).toLocaleDateString()}</span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    selectedPurchase.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    selectedPurchase.status === 'ISSUED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    selectedPurchase.status === 'PARTIALLY_RECEIVED' ? 'bg-pistachio-10 text-ink border border-pistachio-30' :
                    selectedPurchase.status === 'RECEIVED' ? 'bg-aloe-10 text-ink border border-aloe-30' :
                    'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    {selectedPurchase.status}
                  </span>
                </div>
              </div>
              
              {selectedPurchase.expected_delivery_date && (
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Expected Delivery</span>
                  <span className="text-shade-60">{new Date(selectedPurchase.expected_delivery_date).toLocaleDateString()}</span>
                </div>
              )}

              {selectedPurchase.payment_terms && (
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Payment Terms</span>
                  <span className="text-shade-60">{selectedPurchase.payment_terms}</span>
                </div>
              )}

              {selectedPurchase.delivery_address && (
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Delivery Address</span>
                  <p className="text-sm text-shade-60 bg-canvas-cream/30 p-2.5 rounded border border-hairline-light leading-relaxed">
                    {selectedPurchase.delivery_address}
                  </p>
                </div>
              )}

              {selectedPurchase.notes && (
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Notes</span>
                  <p className="text-sm text-shade-60 bg-canvas-cream/30 p-2.5 rounded border border-hairline-light leading-relaxed">
                    {selectedPurchase.notes}
                  </p>
                </div>
              )}

              <div>
                <span className="text-caption text-shade-50 block font-semibold mb-2">Order Items</span>
                <div className="space-y-2 border border-hairline-light rounded-md divide-y divide-hairline-light max-h-56 overflow-y-auto bg-canvas-cream/10">
                  {selectedPurchase.purchase_items.map(item => (
                    <div key={item.id} className="p-3 text-sm flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-ink">{getProductName(item.product_id)}</div>
                        <div className="text-micro text-shade-50 font-mono mt-0.5">₹{Number(item.unit_price).toFixed(2)} × {item.quantity}</div>
                      </div>
                      <div className="font-mono font-semibold text-ink">₹{Number(item.subtotal).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Financial Breakdown */}
              <div className="p-3 rounded-lg border border-hairline-light bg-canvas-cream/20 space-y-1 text-sm font-mono">
                 {(selectedPurchase.discount_rate > 0) && (
                    <div className="flex justify-between text-shade-60">
                      <span>Discount ({selectedPurchase.discount_rate}%)</span>
                      <span className="text-green-600">-</span>
                    </div>
                 )}
                 {(selectedPurchase.tax_rate > 0) && (
                    <div className="flex justify-between text-shade-60">
                      <span>Tax/GST ({selectedPurchase.tax_rate}%)</span>
                      <span>+</span>
                    </div>
                 )}
                 {(selectedPurchase.shipping_charges > 0) && (
                    <div className="flex justify-between text-shade-60">
                      <span>Shipping</span>
                      <span>₹{Number(selectedPurchase.shipping_charges).toFixed(2)}</span>
                    </div>
                 )}
              </div>

              <div className="p-4 rounded-lg bg-canvas-cream/50 border border-hairline-light flex justify-between items-center">
                <span className="text-caption text-shade-50 font-semibold text-body-lg">Total Cost</span>
                <span className="font-mono font-bold text-body-lg text-ink">₹{Number(selectedPurchase.total_amount).toFixed(2)}</span>
              </div>

              {/* Status Actions */}
              {selectedPurchase.status === 'DRAFT' && (
                <div className="flex gap-3 border-t border-hairline-light pt-4 mt-6">
                  <button 
                    onClick={() => updatePurchaseStatus(selectedPurchase.id, 'ISSUED')}
                    className="flex-1 py-2 text-center text-body-md font-semibold bg-primary hover:bg-shade-70 text-on-primary rounded-full transition-all duration-200 cursor-pointer"
                  >
                    Issue PO
                  </button>
                  <button 
                    onClick={() => updatePurchaseStatus(selectedPurchase.id, 'CANCELLED')}
                    className="flex-1 py-2 text-center text-body-md font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-full transition-all duration-200 cursor-pointer"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
              {(selectedPurchase.status === 'ISSUED' || selectedPurchase.status === 'PARTIALLY_RECEIVED') && (
                <div className="flex gap-3 border-t border-hairline-light pt-4 mt-6">
                  <button 
                    onClick={() => handleReceivePurchase(selectedPurchase)}
                    className="flex-1 py-2 text-center text-body-md font-semibold bg-aloe-50 hover:bg-aloe-60 text-ink rounded-full transition-all duration-200 cursor-pointer"
                  >
                    Receive Stock
                  </button>
                  <button 
                    onClick={() => updatePurchaseStatus(selectedPurchase.id, 'CANCELLED')}
                    className="flex-1 py-2 text-center text-body-md font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-full transition-all duration-200 cursor-pointer"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Record Purchase Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-4xl w-full p-6 shadow-xl space-y-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4">
              <h3 className="font-display text-heading-md font-semibold text-ink">Record Purchase Order</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-shade-60 hover:text-ink font-semibold">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{formError}</div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-6 text-body-md text-ink">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-caption font-semibold">PO Number *</label>
                  <input 
                    type="text" 
                    required
                    value={form.po_number} 
                    onChange={(e) => setForm(prev => ({ ...prev, po_number: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono uppercase" 
                    placeholder="e.g. PO-2026-0012"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Supplier *</label>
                  <select
                    required
                    value={form.supplier_id}
                    onChange={(e) => setForm(prev => ({ 
                      ...prev, 
                      supplier_id: e.target.value,
                      // Clear items since supplier changed
                      items: [{ product_id: '', quantity: 1, unit_price: '' }]
                    }))}
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Order Date *</label>
                  <input 
                    type="date" 
                    required
                    value={form.order_date} 
                    onChange={(e) => setForm(prev => ({ ...prev, order_date: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Expected Delivery Date</label>
                  <input 
                    type="date" 
                    value={form.expected_delivery_date} 
                    onChange={(e) => setForm(prev => ({ ...prev, expected_delivery_date: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                  />
                </div>
              </div>

              {/* Line Items Container */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-hairline-light pb-2">
                  <span className="font-semibold text-caption text-shade-60">Product(s) *</span>
                  <button 
                    type="button" 
                    onClick={addLineItem} 
                    className="text-xs font-semibold text-ink hover:text-shade-60 border border-hairline-light rounded-full px-3 py-1 cursor-pointer bg-canvas-cream/10"
                  >
                    + Add Product
                  </button>
                </div>

                {!form.supplier_id && (
                  <p className="text-xs text-amber-600 font-semibold p-2 bg-amber-50 rounded">Please select a supplier first to see their available products.</p>
                )}

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {form.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_80px_120px_40px] gap-3 items-end bg-canvas-cream/20 p-3 rounded border border-hairline-light">
                      <div className="space-y-1 text-left">
                        <label className="text-xs text-shade-50 font-semibold block">Product</label>
                        <select
                          required
                          disabled={!form.supplier_id}
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                          className="px-2 py-1.5 bg-canvas-light border border-hairline-light rounded w-full text-xs focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
                        >
                          <option value="">Select Product</option>
                          {/* Filter products to only show those belonging to the selected supplier */}
                          {products
                            .filter(p => p.supplier_id === Number(form.supplier_id))
                            .map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>)}
                        </select>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-xs text-shade-50 font-semibold block">Qty</label>
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
                        <label className="text-xs text-shade-50 font-semibold block">Unit Cost (₹)</label>
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
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-hairline-light pt-4">
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Tax / GST (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.tax_rate} 
                    onChange={(e) => setForm(prev => ({ ...prev, tax_rate: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                    placeholder="e.g. 18"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Discount (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.discount_rate} 
                    onChange={(e) => setForm(prev => ({ ...prev, discount_rate: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Shipping Charges (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={form.shipping_charges} 
                    onChange={(e) => setForm(prev => ({ ...prev, shipping_charges: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                    placeholder="e.g. 500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-1">
                  <label className="text-caption font-semibold">Payment Terms</label>
                  <input 
                    type="text" 
                    value={form.payment_terms} 
                    onChange={(e) => setForm(prev => ({ ...prev, payment_terms: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                    placeholder="e.g. Net 30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Notes</label>
                  <input 
                    type="text" 
                    value={form.notes} 
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                    placeholder="Deliver before 5 PM..."
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-caption font-semibold">Delivery Address</label>
                  <textarea 
                    value={form.delivery_address} 
                    onChange={(e) => setForm(prev => ({ ...prev, delivery_address: e.target.value }))} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                    placeholder="Main Warehouse..."
                    rows="2"
                  />
                </div>
              </div>

              {/* Total calculations */}
              <div className="flex justify-between items-center border-t border-hairline-light pt-4 mt-6 p-4 rounded bg-canvas-cream/40">
                <span className="font-semibold text-ink">Grand Total Estimation</span>
                <span className="font-mono font-bold text-lg text-ink">₹{getFormTotal().toFixed(2)}</span>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer">
                  {submitting ? 'Recording PO...' : 'Record PO'}
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
              <button onClick={() => setConfirmModal({ open: false, purchaseId: null, newStatus: '' })} className="px-4 py-2 rounded-full border border-hairline-light text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
              <button onClick={handleConfirmAction} className={`px-4 py-2 rounded-full font-semibold cursor-pointer text-white ${confirmModal.newStatus === 'CANCELLED' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-shade-70'}`}>Yes, Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchasesPage;
