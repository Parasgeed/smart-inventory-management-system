import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'UPI',
    payment_reference: '',
    notes: ''
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidingInvoice, setVoidingInvoice] = useState(false);
  const [voidError, setVoidError] = useState('');

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch invoice details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleSendInvoice = async () => {
    try {
      await client.post(`/invoices/${id}/send`);
      fetchInvoice();
    } catch (err) {
      alert('Failed to send invoice');
    }
  };

  const handleVoidInvoiceClick = () => {
    setVoidModalOpen(true);
  };

  const confirmVoidInvoice = async () => {
    setVoidingInvoice(true);
    setVoidError('');
    try {
      await client.post(`/invoices/${id}/void`);
      setVoidModalOpen(false);
      fetchInvoice();
    } catch (err) {
      setVoidError(err.response?.data?.detail || 'Failed to void invoice');
    } finally {
      setVoidingInvoice(false);
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  const handleRazorpayPayment = async () => {
    const res = await loadRazorpay();
    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      return;
    }

    try {
      // 1. Create order
      const orderRes = await client.post('/payments/razorpay/create-order', {
        invoice_id: parseInt(id),
        amount: Number(invoice.balance_due)
      });
      const orderData = orderRes.data;

      // 2. Init Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Smart Inventory Inc.',
        description: `Payment for Invoice #${invoice.invoice_number}`,
        order_id: orderData.order_id,
        handler: async function (response) {
          // 3. Verify payment
          try {
            await client.post('/payments/razorpay/verify', {
              invoice_id: parseInt(id),
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            fetchInvoice();
          } catch (err) {
            alert(err.response?.data?.detail || 'Payment Verification Failed!');
          }
        },
        prefill: {
          name: 'Customer Name',
          email: 'billing@smartinventory.com'
        },
        theme: {
          color: '#000000'
        }
      };
      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to initialize payment');
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setSubmittingPayment(true);
    setPaymentError('');
    try {
      await client.post(`/invoices/${id}/record-payment`, {
        ...paymentForm,
        amount: Number(paymentForm.amount)
      });
      setPaymentDrawerOpen(false);
      setPaymentForm({ amount: '', payment_method: 'UPI', payment_reference: '', notes: '' });
      fetchInvoice();
    } catch (err) {
      setPaymentError(err.response?.data?.detail || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading && !invoice) {
    return <div className="p-xl text-center">Loading Invoice...</div>;
  }
  if (error || !invoice) {
    return <div className="p-xl text-danger">{error || 'Invoice not found'}</div>;
  }

  const StatusBadge = ({ status }) => {
    const colors = {
      DRAFT: 'bg-shade-30 text-ink',
      SENT: 'bg-blue-100 text-blue-800',
      PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
      PAID: 'bg-aloe-10 text-ink',
      OVERDUE: 'bg-red-100 text-red-800',
      VOID: 'bg-shade-40 text-on-primary',
    };
    const color = colors[status] || colors.DRAFT;
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{status}</span>;
  };

  return (
    <div className="flex flex-col h-full font-sans pb-xl">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-4">
        <div>
          <button onClick={() => navigate('/invoices')} className="text-primary hover:underline text-sm mb-2 flex items-center">
            &larr; Back to Invoices
          </button>
          <h1 className="text-display-sm font-display font-light text-ink tracking-tight flex items-center gap-3">
            {invoice.invoice_number}
            <StatusBadge status={invoice.status} />
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === 'DRAFT' && (
            <button onClick={handleSendInvoice} className="px-5 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer font-semibold text-sm">Send Invoice</button>
          )}
          {['DRAFT', 'SENT', 'PARTIALLY_PAID'].includes(invoice.status) && (
            <>
              <button 
                onClick={handleRazorpayPayment}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold cursor-pointer text-sm transition-colors"
              >
                Pay Online
              </button>
              <button 
                onClick={() => {
                  setPaymentForm(prev => ({ ...prev, amount: invoice.balance_due }));
                  setPaymentDrawerOpen(true);
                }} 
                className="px-5 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer text-sm"
              >
                Record Payment
              </button>
            </>
          )}
          {['DRAFT', 'SENT', 'PARTIALLY_PAID'].includes(invoice.status) && (
            <button onClick={handleVoidInvoiceClick} className="px-5 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-full font-semibold cursor-pointer text-sm">Void Invoice</button>
          )}
          <button className="px-5 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer font-semibold text-sm" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      {/* Invoice Document Layout */}
      <div className="card max-w-4xl w-full mx-auto p-8 md:p-12 shadow-md bg-white text-gray-900 border border-gray-200 printable-area">
        <div className="flex justify-between items-start mb-12">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-800 mb-1">INVOICE</h2>
            <p className="text-gray-500 font-medium">#{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-xl text-gray-800 mb-1">Smart Inventory Inc.</h3>
            <p className="text-sm text-gray-500">123 Business Road<br/>Tech City, TC 10010<br/>billing@smartinventory.com</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</p>
            <p className="font-semibold text-gray-800 text-lg">Customer #{invoice.customer_id || 'Walk-in'}</p>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Issue Date:</span>
              <span className="font-medium text-gray-800">{new Date(invoice.issue_date).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Linked SO:</span>
              <span className="font-medium text-gray-800">SO #{invoice.sales_order_id}</span>
            </div>
          </div>
        </div>

        <table className="w-full text-left mb-8 border-t border-gray-200">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item ID</th>
              <th className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Qty</th>
              <th className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Price</th>
              <th className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items.map(item => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-4 font-medium text-gray-800">Product #{item.product_id}</td>
                <td className="py-4 text-right text-gray-600">{item.quantity}</td>
                <td className="py-4 text-right text-gray-600">${Number(item.unit_price).toFixed(2)}</td>
                <td className="py-4 text-right font-medium text-gray-800">${Number(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-12">
          <div className="w-64">
            <div className="flex justify-between py-2 text-gray-600">
              <span>Subtotal</span>
              <span>${Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 text-gray-600">
              <span>Tax & Discount</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between py-3 border-t border-gray-200 font-bold text-xl text-gray-800">
              <span>Total</span>
              <span>${Number(invoice.total_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 text-gray-500 text-sm">
              <span>Amount Paid</span>
              <span>${Number(invoice.amount_paid).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 text-danger font-bold">
              <span>Balance Due</span>
              <span>${Number(invoice.balance_due).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Drawer */}
      {paymentDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 flex items-center justify-center animate-fadeIn">
          <div className="bg-canvas-light w-full max-w-md rounded-xl shadow-[0_8px_8px_rgba(0,0,0,0.05),_0_4px_4px_rgba(0,0,0,0.05),_0_2px_2px_rgba(0,0,0,0.05),_0_0_0_1px_rgba(0,0,0,0.05)] border border-hairline-light p-xl mx-4 transition-all transform scale-100 opacity-100">
            <h3 className="text-heading-sm font-display font-semibold text-ink mb-md">Record Payment</h3>
            <p className="text-body-md text-shade-50 mb-lg">Balance Due: <strong className="text-red-700 font-mono">${Number(invoice.balance_due).toFixed(2)}</strong></p>
            {paymentError && <p className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 animate-fadeIn mb-4">{paymentError}</p>}
            
            <form onSubmit={submitPayment} className="space-y-6">
              <div className="space-y-1">
                <label className="block text-caption font-semibold text-ink">Amount</label>
                <input 
                  type="number" 
                  step="0.01" 
                  max={Number(invoice.balance_due)}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                  required 
                  className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-caption font-semibold text-ink">Payment Method</label>
                <select 
                  value={paymentForm.payment_method}
                  onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                  className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-caption font-semibold text-ink">Reference (Optional)</label>
                <input 
                  type="text" 
                  value={paymentForm.payment_reference}
                  onChange={e => setPaymentForm({...paymentForm, payment_reference: e.target.value})}
                  className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md"
                  placeholder="Txn ID"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPaymentDrawerOpen(false)} className="px-5 py-2.5 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream cursor-pointer font-semibold text-body-md transition-colors duration-200">Cancel</button>
                <button type="submit" disabled={submittingPayment} className="px-5 py-2.5 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer text-body-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center">
                  {submittingPayment ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-on-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </span>
                  ) : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Void Invoice Drawer */}
      {voidModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 flex items-center justify-center animate-fadeIn">
          <div className="bg-canvas-light w-full max-w-md rounded-xl shadow-[0_8px_8px_rgba(0,0,0,0.05),_0_4px_4px_rgba(0,0,0,0.05),_0_2px_2px_rgba(0,0,0,0.05),_0_0_0_1px_rgba(0,0,0,0.05)] border border-hairline-light p-xl mx-4 transition-all transform scale-100 opacity-100">
            <div className="flex items-center gap-3 mb-md text-red-700">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-heading-sm font-display font-semibold text-ink">Void Invoice?</h3>
            </div>
            
            <p className="text-body-md text-shade-50 mb-lg">Are you sure you want to VOID this invoice? This action cannot be reversed and will render the invoice permanently invalid.</p>
            {voidError && <p className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 animate-fadeIn mb-4">{voidError}</p>}
            
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setVoidModalOpen(false)} className="px-5 py-2.5 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream cursor-pointer font-semibold text-body-md transition-colors duration-200">Cancel</button>
              <button type="button" onClick={confirmVoidInvoice} disabled={voidingInvoice} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold cursor-pointer text-body-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center">
                {voidingInvoice ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Voiding...
                  </span>
                ) : 'Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceDetailPage;
