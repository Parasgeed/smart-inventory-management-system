import { useState, useEffect } from 'react';
import client from '../api/client';
import { Link } from 'react-router-dom';

function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/invoices/');
      setInvoices(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    return <span className={`px-3 py-1 rounded-pill text-eyebrow-cap font-semibold ${color}`}>{status}</span>;
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? inv.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Invoices</h2>
          <p className="text-caption text-shade-50">Manage all billing and receivables.</p>
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
              placeholder="Search Invoice #..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-grow px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md placeholder-shade-40 focus:outline-none focus:ring-1 focus:ring-ink"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink min-w-[140px]"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SENT">SENT</option>
              <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="VOID">VOID</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-16">
              <svg className="animate-spin h-8 w-8 text-shade-60" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-16 text-shade-50">
              <p className="text-body-lg font-semibold">No invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Issue Date</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {filteredInvoices.map(inv => (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-canvas-cream/40 transition-all duration-150"
                    >
                      <td className="py-4 px-4 font-mono font-semibold text-ink">
                        <Link to={`/invoices/${inv.id}`} className="hover:underline text-ink">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="py-4 px-4"><StatusBadge status={inv.status} /></td>
                      <td className="py-4 px-4 text-shade-60">
                        {new Date(inv.issue_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-ink">
                        ₹{Number(inv.total_amount).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-red-700">
                        ₹{Number(inv.balance_due).toFixed(2)}
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

export default InvoicesPage;
