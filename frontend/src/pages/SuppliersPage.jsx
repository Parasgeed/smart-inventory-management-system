// frontend/src/pages/SuppliersPage.jsx
import { useState, useEffect } from 'react';
import client from '../api/client';

function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  
  const [deleteSupplier, setDeleteSupplier] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const initialForm = {
    name: '',
    phone: '',
    email: '',
    address: '',
    gst_number: ''
  };
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await client.get('/suppliers/');
      setSuppliers(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch suppliers.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenCreate = () => {
    setEditSupplier(null);
    setForm(initialForm);
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setEditSupplier(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      gst_number: supplier.gst_number || ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    if (!form.name.trim() || form.name.trim().length < 2) {
      setFormError('Supplier name must be at least 2 characters.');
      setSubmitting(false);
      return;
    }

    if (!form.phone.trim() || form.phone.trim().length < 10) {
      setFormError('Phone number must be at least 10 digits.');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      gst_number: form.gst_number.trim() || null
    };

    try {
      if (editSupplier) {
        await client.put(`/suppliers/${editSupplier.id}`, payload);
      } else {
        await client.post('/suppliers/', payload);
      }
      setModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to save supplier details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (supplier) => {
    setDeleteError('');
    setDeleteSupplier(supplier);
  };

  const confirmDelete = async () => {
    if (!deleteSupplier) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await client.delete(`/suppliers/${deleteSupplier.id}`);
      setDeleteSupplier(null);
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setDeleteError(err.response?.data?.detail || 'Cannot delete supplier with active products.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Suppliers</h2>
          <p className="text-caption text-shade-50">Manage vendor contact cards, phone records, GST identifiers, and shipping origins.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors duration-200 cursor-pointer"
        >
          Add Supplier
        </button>
      </div>

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
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16 text-shade-50">
            <p className="text-body-lg font-semibold">No suppliers found</p>
            <p className="text-caption mt-1">Click Add Supplier to record your first vendor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">GST Number</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                {suppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-canvas-cream/20">
                    <td className="py-4 px-4 font-semibold text-ink">{supplier.name}</td>
                    <td className="py-4 px-4 font-mono">{supplier.phone}</td>
                    <td className="py-4 px-4 text-shade-60">{supplier.email || '—'}</td>
                    <td className="py-4 px-4 font-mono text-xs text-shade-50">{supplier.gst_number || '—'}</td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => handleOpenEdit(supplier)}
                          className="p-1.5 rounded-full hover:bg-shade-30 text-shade-60 hover:text-ink transition-colors cursor-pointer"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(supplier)}
                          className="p-1.5 rounded-full hover:bg-red-50 text-shade-60 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-md w-full p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4">
              <h3 className="font-display text-heading-md font-semibold text-ink">
                {editSupplier ? `Edit Supplier: ${editSupplier.name}` : 'Add New Supplier'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-shade-60 hover:text-ink font-semibold cursor-pointer">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-body-md text-ink">
              <div className="space-y-1">
                <label className="text-caption font-semibold">Supplier Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  value={form.name} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Apex Electronics" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">Phone Number (10+ digits) *</label>
                <input 
                  type="tel" 
                  name="phone" 
                  required 
                  value={form.phone} 
                  onChange={handleInputChange} 
                  placeholder="e.g. 9876543210" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  value={form.email} 
                  onChange={handleInputChange} 
                  placeholder="vendor@example.com" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">GST Number</label>
                <input 
                  type="text" 
                  name="gst_number" 
                  value={form.gst_number} 
                  onChange={handleInputChange} 
                  placeholder="e.g. 22AAAAA0000A1Z5" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">Address</label>
                <textarea 
                  name="address" 
                  value={form.address} 
                  onChange={handleInputChange} 
                  placeholder="Street, City, State..." 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                  rows="2"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer">
                  {submitting ? 'Saving...' : editSupplier ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteSupplier && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <h3 className="font-display text-heading-md font-semibold text-ink">Delete Supplier?</h3>
            <p className="text-body-md text-shade-60 pb-2">
              Are you sure you want to delete <strong>{deleteSupplier.name}</strong>? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium text-left mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex justify-center space-x-3 pt-2">
              <button 
                onClick={() => setDeleteSupplier(null)} 
                disabled={isDeleting}
                className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuppliersPage;
