import { useState, useEffect } from 'react';
import client from '../api/client';
import { Link } from 'react-router-dom';

function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/payments/');
      setPayments(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.payment_reference 
        ? payment.payment_reference.toLowerCase().includes(search.toLowerCase()) 
        : false;
    
    // allow searching by invoice_id too
    const matchesInvoiceId = payment.invoice_id.toString().includes(search);
    
    const matchesSearchFilter = search === '' ? true : (matchesSearch || matchesInvoiceId);
    const matchesMethod = methodFilter ? payment.payment_method === methodFilter : true;
    
    return matchesSearchFilter && matchesMethod;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Payments</h2>
          <p className="text-caption text-shade-50">View all recorded payments and receipts.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-600 font-medium">
          {error}
        </div>
      )}

      <div className="grid gap-6 grid-cols-1">
        <div className="bg-canvas-light rounded-lg border border-hairline-light p-6 shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Search Reference or Invoice ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-grow px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md placeholder-shade-40 focus:outline-none focus:ring-1 focus:ring-ink"
            />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink min-w-[160px]"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Wallet">Wallet</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-16">
              <svg className="animate-spin h-8 w-8 text-shade-60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-16 text-shade-50">
              <p className="text-body-lg font-semibold">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {filteredPayments.map(payment => (
                    <tr 
                      key={payment.id} 
                      className="hover:bg-canvas-cream/40 transition-all duration-150"
                    >
                      <td className="py-4 px-4 font-mono font-semibold text-ink">
                        #{payment.id}
                      </td>
                      <td className="py-4 px-4 font-mono font-semibold text-primary hover:underline cursor-pointer">
                        <Link to={`/invoices/${payment.invoice_id}`}>
                          {payment.invoice_id}
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-shade-60">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 rounded-pill text-eyebrow-cap font-semibold bg-shade-30 text-ink">
                          {payment.payment_method}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-shade-60">
                        {payment.payment_reference || '-'}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-aloe-60">
                        ₹{Number(payment.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentsPage;
