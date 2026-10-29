import { useState, useEffect } from 'react';
import client from '../api/client';

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const PurchaseReturnsPage = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Return form state
  const [purchaseId, setPurchaseId] = useState('');
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  
  const [returnItems, setReturnItems] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [formError, setFormError] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await client.get('/purchase-returns/');
        setReturns(res.data);
      } catch {
        // ignore
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const fetchReturns = async () => {
    try {
      const res = await client.get('/purchase-returns/');
      setReturns(res.data);
    } catch {
      // ignore
    }
  };

  const handleFetchOrder = async () => {
    if (!purchaseId) return;
    const parsedId = parseInt(purchaseId, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      setOrderError('Please enter a valid positive Purchase Order ID');
      setPurchaseOrder(null);
      setReturnItems([]);
      setFormError('');
      return;
    }

    setLoadingOrder(true);
    setOrderError('');
    setFormError('');
    try {
      const res = await client.get(`/purchases/${parsedId}`);
      setPurchaseOrder(res.data);
      // Pre-fill return items with 0 quantity
      setReturnItems(res.data.purchase_items.map(item => ({
        product_id: item.product_id,
        max_quantity: item.quantity,
        unit_price: item.unit_price,
        quantity: 0,
        refund_amount: 0,
        reason: ''
      })));
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : (detail || 'Purchase order not found');
      setOrderError(errorMsg);
      setPurchaseOrder(null);
      setReturnItems([]);
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleQuantityChange = (index, val) => {
    const rawQty = parseInt(val) || 0;
    // Enforce 0 <= qty <= max_quantity
    const qty = Math.max(0, Math.min(rawQty, returnItems[index].max_quantity));
    const newItems = [...returnItems];
    newItems[index].quantity = qty;
    newItems[index].refund_amount = qty * newItems[index].unit_price;
    setReturnItems(newItems);
    if (formError) setFormError('');
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    setFormError('');
    const itemsToReturn = returnItems.filter(i => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      setFormError("Please select at least one item to return by setting Return Qty greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/purchase-returns/', {
        purchase_id: parseInt(purchaseId),
        notes: returnNotes,
        items: itemsToReturn.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          refund_amount: parseFloat(i.refund_amount),
          reason: i.reason
        }))
      });
      setCreateModalOpen(false);
      setFormError('');
      fetchReturns();
      // Reset form
      setPurchaseId('');
      setPurchaseOrder(null);
      setReturnNotes('');
      setReturnItems([]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : (detail || 'Failed to create return');
      setFormError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-display-sm font-display font-light text-ink tracking-tight">Purchase Returns</h1>
        <button 
          onClick={() => {
            setFormError('');
            setCreateModalOpen(true);
          }}
          className="px-5 py-2.5 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer text-sm transition-colors shadow-sm"
        >
          Create Return
        </button>
      </div>

      {/* List */}
      <div className="bg-canvas-light rounded-2xl shadow-sm border border-hairline-light overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-hairline-light bg-canvas-cream/50">
                <th className="p-4 text-caption font-semibold text-shade-50">Return ID</th>
                <th className="p-4 text-caption font-semibold text-shade-50">Purchase ID</th>
                <th className="p-4 text-caption font-semibold text-shade-50">Date</th>
                <th className="p-4 text-caption font-semibold text-shade-50">Total Refund</th>
                <th className="p-4 text-caption font-semibold text-shade-50">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-light">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-shade-40">Loading...</td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-shade-40 font-medium">No returns found</td></tr>
              ) : (
                returns.map(r => (
                  <tr key={r.id} className="hover:bg-canvas-cream/30 transition-colors">
                    <td className="p-4 font-semibold text-ink">#{r.id}</td>
                    <td className="p-4 text-shade-60">#{r.purchase_id}</td>
                    <td className="p-4 text-shade-60">{formatDate(r.return_date)}</td>
                    <td className="p-4 font-medium text-ink">₹{Number(r.total_refund_amount).toLocaleString()}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-shade-30 text-ink text-xs font-semibold rounded-full uppercase tracking-wider">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center animate-fadeIn p-4">
          <div className="bg-canvas-light w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-hairline-light flex justify-between items-center bg-canvas-cream">
              <h2 className="text-xl font-display font-medium text-ink">Process Purchase Return</h2>
              <button 
                onClick={() => {
                  setCreateModalOpen(false);
                  setFormError('');
                }} 
                className="text-shade-40 hover:text-ink transition-colors"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {formError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start justify-between shadow-sm animate-fadeIn">
                  <div className="flex items-center space-x-2.5">
                    <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">{formError}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormError('')} 
                    className="text-red-400 hover:text-red-700 transition-colors ml-3 font-bold text-lg leading-none"
                    aria-label="Dismiss alert"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Order Lookup */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="block text-caption font-semibold text-ink">Purchase Order ID</label>
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    value={purchaseId}
                    onKeyDown={e => {
                      if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={e => {
                      const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                      setPurchaseId(cleanVal);
                    }}
                    className="w-full border border-hairline-light rounded-lg px-3 py-2 outline-none focus:border-ink transition-colors"
                    placeholder="Enter positive Purchase ID (e.g. 1)"
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleFetchOrder}
                  disabled={loadingOrder || !purchaseId}
                  className="px-4 py-2 border border-ink text-ink hover:bg-ink hover:text-canvas-light rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loadingOrder ? 'Loading...' : 'Lookup'}
                </button>
              </div>
              
              {orderError && <p className="text-red-500 text-sm font-medium">{orderError}</p>}

              {purchaseOrder && (
                <form id="returnForm" onSubmit={submitReturn} className="space-y-6 animate-fadeIn">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-ink">Items from Purchase #{purchaseOrder.id}</h3>
                    <div className="border border-hairline-light rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-canvas-cream">
                          <tr>
                            <th className="p-3 font-semibold text-shade-60">Product ID</th>
                            <th className="p-3 font-semibold text-shade-60">Max Qty</th>
                            <th className="p-3 font-semibold text-shade-60">Return Qty</th>
                            <th className="p-3 font-semibold text-shade-60">Refund (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline-light">
                          {returnItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-3 text-ink">#{item.product_id}</td>
                              <td className="p-3 text-shade-50">{item.max_quantity}</td>
                              <td className="p-3">
                                <input 
                                  type="number" 
                                  min="0" 
                                  max={item.max_quantity}
                                  value={item.quantity}
                                  onKeyDown={e => {
                                    if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={e => handleQuantityChange(idx, e.target.value)}
                                  className="w-20 border border-hairline-light rounded px-2 py-1 outline-none focus:border-ink"
                                />
                              </td>
                              <td className="p-3 font-medium text-ink">
                                {item.refund_amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-caption font-semibold text-ink">Return Notes / Reason</label>
                    <textarea 
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                      className="w-full border border-hairline-light rounded-lg px-3 py-2 outline-none focus:border-ink transition-colors"
                      rows="3"
                    ></textarea>
                  </div>
                </form>
              )}
            </div>

            <div className="p-6 border-t border-hairline-light bg-canvas-cream flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setCreateModalOpen(false);
                  setFormError('');
                }}
                className="px-5 py-2 text-ink font-semibold hover:bg-shade-30/50 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="returnForm"
                disabled={submitting || !purchaseOrder}
                className="px-5 py-2 bg-ink text-canvas-light hover:bg-shade-70 rounded-full font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Process Return & Deduct Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseReturnsPage;
