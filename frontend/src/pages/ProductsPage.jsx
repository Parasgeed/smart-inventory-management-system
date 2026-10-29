import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals & Drawer states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [productLogs, setProductLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Quick inline creation modals for Category & Supplier
  const [quickCategoryModal, setQuickCategoryModal] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [quickCategoryDesc, setQuickCategoryDesc] = useState('');
  
  const [quickSupplierModal, setQuickSupplierModal] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierEmail, setQuickSupplierEmail] = useState('');
  const [quickSupplierGst, setQuickSupplierGst] = useState('');

  const [quickError, setQuickError] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // Form states
  const initialFormState = {
    name: '',
    description: '',
    sku: '',
    barcode: '',
    quantity: 0,
    cost_price: '',
    selling_price: '',
    reorder_level: 5,
    supplier_id: '',
    category_id: ''
  };
  const [form, setForm] = useState(initialFormState);
  const [adjustForm, setAdjustForm] = useState({ quantity_changed: '', change_type: 'ADJUSTMENT' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      setCurrentUser(JSON.parse(userString));
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, catRes, supRes] = await Promise.all([
        client.get('/products/?limit=100'),
        client.get('/categories/'),
        client.get('/suppliers/')
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      setSuppliers(supRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data from database.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductLogs = async (productId) => {
    setLogsLoading(true);
    try {
      const response = await client.get(`/inventory-logs/product/${productId}`);
      setProductLogs(response.data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRowClick = (product) => {
    setSelectedProduct(product);
    fetchProductLogs(product.id);
  };

  // Prevent typing minus sign in numeric inputs
  const preventMinus = (e) => {
    if (e.key === '-' || e.key === 'e') {
      e.preventDefault();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAdjustInputChange = (e) => {
    const { name, value } = e.target;
    setAdjustForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Create Quick Category
  const handleCreateQuickCategory = async (e) => {
    e.preventDefault();
    setQuickError('');
    setQuickSubmitting(true);

    if (!quickCategoryName.trim() || quickCategoryName.trim().length < 2) {
      setQuickError('Category name must be at least 2 characters.');
      setQuickSubmitting(false);
      return;
    }

    try {
      const res = await client.post('/categories/', {
        name: quickCategoryName.trim(),
        description: quickCategoryDesc.trim() || null
      });
      const newCategory = res.data;
      setCategories(prev => [...prev, newCategory]);
      setForm(prev => ({ ...prev, category_id: newCategory.id }));
      setQuickCategoryModal(false);
      setQuickCategoryName('');
      setQuickCategoryDesc('');
    } catch (err) {
      console.error(err);
      setQuickError(err.response?.data?.detail || 'Failed to create category.');
    } finally {
      setQuickSubmitting(false);
    }
  };

  // Create Quick Supplier
  const handleCreateQuickSupplier = async (e) => {
    e.preventDefault();
    setQuickError('');
    setQuickSubmitting(true);

    if (!quickSupplierName.trim() || quickSupplierName.trim().length < 2) {
      setQuickError('Supplier name must be at least 2 characters.');
      setQuickSubmitting(false);
      return;
    }

    if (!quickSupplierPhone.trim() || quickSupplierPhone.trim().length < 10) {
      setQuickError('Phone number must be at least 10 digits.');
      setQuickSubmitting(false);
      return;
    }

    try {
      const res = await client.post('/suppliers/', {
        name: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim(),
        email: quickSupplierEmail.trim() || null,
        gst_number: quickSupplierGst.trim() || null
      });
      const newSupplier = res.data;
      setSuppliers(prev => [...prev, newSupplier]);
      setForm(prev => ({ ...prev, supplier_id: newSupplier.id }));
      setQuickSupplierModal(false);
      setQuickSupplierName('');
      setQuickSupplierPhone('');
      setQuickSupplierEmail('');
      setQuickSupplierGst('');
    } catch (err) {
      console.error(err);
      setQuickError(err.response?.data?.detail || 'Failed to create supplier.');
    } finally {
      setQuickSubmitting(false);
    }
  };

  // Create Product Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const cost = Number(form.cost_price);
    const selling = Number(form.selling_price);

    if (isNaN(cost) || cost < 0) {
      setFormError('Cost price must be a non-negative number (≥ 0).');
      setSubmitting(false);
      return;
    }

    if (isNaN(selling) || selling < 0) {
      setFormError('Selling price must be a non-negative number (≥ 0).');
      setSubmitting(false);
      return;
    }

    if (!form.category_id) {
      setFormError('Please select or create a Category.');
      setSubmitting(false);
      return;
    }

    if (!form.supplier_id) {
      setFormError('Please select or create a Supplier.');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,
      quantity: Math.max(0, Number(form.quantity)),
      cost_price: cost,
      selling_price: selling,
      reorder_level: Math.max(0, Number(form.reorder_level)),
      supplier_id: Number(form.supplier_id),
      category_id: Number(form.category_id)
    };

    try {
      await client.post('/products/', payload);
      setAddModalOpen(false);
      setForm(initialFormState);
      fetchData();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Product Setup
  const openEditModal = (product, e) => {
    e.stopPropagation();
    setEditProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      sku: product.sku,
      barcode: product.barcode || '',
      quantity: product.quantity,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      reorder_level: product.reorder_level,
      supplier_id: product.supplier_id,
      category_id: product.category_id
    });
  };

  // Edit Product Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const cost = Number(form.cost_price);
    const selling = Number(form.selling_price);

    if (isNaN(cost) || cost < 0) {
      setFormError('Cost price must be a non-negative number (≥ 0).');
      setSubmitting(false);
      return;
    }

    if (isNaN(selling) || selling < 0) {
      setFormError('Selling price must be a non-negative number (≥ 0).');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.name,
      description: form.description,
      barcode: form.barcode,
      cost_price: cost,
      selling_price: selling,
      reorder_level: Math.max(0, Number(form.reorder_level)),
      supplier_id: Number(form.supplier_id),
      category_id: Number(form.category_id)
    };

    try {
      await client.put(`/products/${editProduct.id}`, payload);
      setEditProduct(null);
      setForm(initialFormState);
      fetchData();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to update product.');
    } finally {
      setSubmitting(false);
    }
  };

  // Adjust Stock Setup
  const openAdjustModal = (product, e) => {
    e.stopPropagation();
    setAdjustProduct(product);
    setAdjustForm({ quantity_changed: '', change_type: 'ADJUSTMENT' });
  };

  // Adjust Stock Submit
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const payload = {
      quantity_changed: Number(adjustForm.quantity_changed),
      change_type: adjustForm.change_type
    };

    try {
      await client.post(`/products/${adjustProduct.id}/adjust`, payload);
      setAdjustProduct(null);
      fetchData();
      if (selectedProduct && selectedProduct.id === adjustProduct.id) {
        const updatedRes = await client.get(`/products/${adjustProduct.id}`);
        setSelectedProduct(updatedRes.data);
        fetchProductLogs(adjustProduct.id);
      }
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to adjust stock. Check if requested decrease exceeds current stock.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Product Setup
  const handleDeleteProductClick = (product, e) => {
    e.stopPropagation();
    setDeleteError('');
    setDeleteProduct(product);
  };

  // Delete Product Confirm
  const confirmDeleteProduct = async () => {
    if (!deleteProduct) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await client.delete(`/products/${deleteProduct.id}`);
      if (selectedProduct && selectedProduct.id === deleteProduct.id) {
        setSelectedProduct(null);
      }
      setDeleteProduct(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setDeleteError(err.response?.data?.detail || 'Failed to delete product.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || 'Unassigned';
  const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || 'Unassigned';

  // Client-side filtering logic
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || 
                          product.sku.toLowerCase().includes(search.toLowerCase()) ||
                          (product.barcode && product.barcode.includes(search));
    const matchesCategory = selectedCategory ? product.category_id === Number(selectedCategory) : true;
    const matchesSupplier = selectedSupplier ? product.supplier_id === Number(selectedSupplier) : true;
    
    let matchesStatus = true;
    if (selectedStatus === 'out') {
      matchesStatus = product.quantity === 0;
    } else if (selectedStatus === 'low') {
      matchesStatus = product.quantity > 0 && product.quantity <= product.reorder_level;
    } else if (selectedStatus === 'in') {
      matchesStatus = product.quantity > product.reorder_level;
    }

    return matchesSearch && matchesCategory && matchesSupplier && matchesStatus;
  });

  // Client-side pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedSupplier, selectedStatus]);

  return (
    <div className="space-y-6 font-sans">
      {/* Header and Add button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-display-md font-display font-light text-ink tracking-tight">Products</h2>
          <p className="text-caption text-shade-50">Manage items, reorder limits, pricing margins, and manual stock audits.</p>
        </div>
        <button 
          onClick={() => { setForm(initialFormState); setFormError(''); setAddModalOpen(true); }}
          className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors duration-200 cursor-pointer"
        >
          Add Product
        </button>
      </div>

      {/* Main Container: Table + Details Drawer */}
      <div className="grid gap-6 grid-cols-1">
        
        {/* Table Side */}
        <div className="bg-canvas-light rounded-lg border border-hairline-light p-6 shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_4px_4px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Search by name, SKU or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink placeholder-shade-40 text-body-md focus:outline-none focus:ring-1 focus:ring-ink"
            />
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink"
            >
              <option value="">All Suppliers ({suppliers.length})</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 bg-canvas-light border border-hairline-light rounded-md text-ink text-body-md focus:outline-none focus:ring-1 focus:ring-ink"
            >
              <option value="">All Stock Statuses</option>
              <option value="in">In Stock (Normal)</option>
              <option value="low">Low Stock (≤ reorder level)</option>
              <option value="out">Out of Stock (= 0)</option>
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
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-shade-50">
              <p className="text-body-lg font-semibold">No products found</p>
              <p className="text-caption mt-1">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                    <th className="py-3 px-4">Product Info</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Pricing</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                  {paginatedProducts.map(product => {
                    const isOutOfStock = product.quantity === 0;
                    const isLowStock = product.quantity > 0 && product.quantity <= product.reorder_level;
                    
                    return (
                      <tr 
                        key={product.id}
                        onClick={() => handleRowClick(product)}
                        className={`hover:bg-canvas-cream/40 cursor-pointer transition-all duration-150 ${selectedProduct?.id === product.id ? 'bg-canvas-cream/70' : ''}`}
                      >
                        <td className="py-4 px-4">
                          <div className="font-semibold text-ink leading-tight">{product.name}</div>
                          <div className="text-micro text-shade-50 mt-1 font-mono">SKU: {product.sku}</div>
                        </td>
                        <td className="py-4 px-4 text-shade-60">{getCategoryName(product.category_id)}</td>
                        <td className="py-4 px-4 text-shade-60 truncate max-w-[140px]">{getSupplierName(product.supplier_id)}</td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-ink">₹{Number(product.selling_price).toFixed(2)}</div>
                          <div className="text-micro text-shade-50 mt-0.5">Cost: ₹{Number(product.cost_price).toFixed(2)}</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {isOutOfStock ? (
                            <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-600 border border-red-200">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-pistachio-10 text-ink">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-aloe-10 text-ink">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold font-mono">{product.quantity}</td>
                        <td className="py-4 px-4 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/forecasting?product_id=${product.id}`);
                              }}
                              title="Forecast Demand"
                              className="p-1.5 rounded-full hover:bg-canvas-cream border border-transparent hover:border-hairline-light text-shade-60 hover:text-ink transition-colors cursor-pointer"
                            >
                              📈
                            </button>
                            <button 
                              onClick={(e) => openAdjustModal(product, e)}
                              title="Adjust Stock"
                              className="p-1.5 rounded-full hover:bg-aloe-10 text-shade-60 hover:text-ink transition-colors cursor-pointer"
                            >
                              ⚙️
                            </button>
                            <button 
                              onClick={(e) => openEditModal(product, e)}
                              title="Edit Details"
                              className="p-1.5 rounded-full hover:bg-shade-30 text-shade-60 hover:text-ink transition-colors cursor-pointer"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={(e) => handleDeleteProductClick(product, e)}
                              title="Delete"
                              className="p-1.5 rounded-full hover:bg-red-50 text-shade-60 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>

                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredProducts.length > 0 && (
            <div className="flex items-center justify-between border-t border-hairline-light mt-6 pt-4 text-caption text-shade-50">
              <div>
                Showing {Math.min(filteredProducts.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredProducts.length, currentPage * itemsPerPage)} of {filteredProducts.length} entries
              </div>
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-4 py-1.5 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                >
                  Previous
                </button>
                <div className="font-semibold text-ink">Page {currentPage} of {totalPages}</div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-4 py-1.5 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Side: Product Detail */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-40">
            <div className="w-full max-w-lg bg-canvas-light h-full shadow-2xl border-l border-hairline-light p-6 overflow-y-auto animate-slideLeft">
              <div className="flex justify-between items-start border-b border-hairline-light pb-4 mb-4">
              <div>
                <h3 className="font-display text-heading-md font-semibold text-ink">{selectedProduct.name}</h3>
                <p className="text-micro text-shade-50 font-mono mt-0.5">ID: #{selectedProduct.id}</p>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-full hover:bg-shade-30 text-shade-60 hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/forecasting?product_id=${selectedProduct.id}`)}
              className="w-full py-2 px-3 bg-canvas-cream border border-hairline-light hover:bg-shade-30 text-ink font-semibold rounded-md text-caption transition-colors flex items-center justify-center space-x-2 shadow-sm"
            >
              <span>📈</span>
              <span>Forecast Demand for this Product</span>
            </button>

            <div className="space-y-4 text-body-md text-ink">
              <div>
                <span className="text-caption text-shade-50 block font-semibold">SKU / Barcode</span>

                <span className="font-mono">{selectedProduct.sku} {selectedProduct.barcode ? `/ ${selectedProduct.barcode}` : ''}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Category</span>
                  <span>{getCategoryName(selectedProduct.category_id)}</span>
                </div>
                <div>
                  <span className="text-caption text-shade-50 block font-semibold">Supplier</span>
                  <span className="truncate block" title={getSupplierName(selectedProduct.supplier_id)}>{getSupplierName(selectedProduct.supplier_id)}</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-canvas-cream/50 border border-hairline-light space-y-2">
                <div className="flex justify-between">
                  <span className="text-caption text-shade-50 font-semibold">Selling Price</span>
                  <span className="font-semibold font-mono">₹{Number(selectedProduct.selling_price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-caption text-shade-50 font-semibold">Cost Price</span>
                  <span className="font-semibold font-mono">₹{Number(selectedProduct.cost_price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-hairline-light pt-2 mt-2">
                  <span className="text-caption text-shade-50 font-semibold">Markup Margin</span>
                  <span className="font-semibold text-green-700 font-mono">
                    {Number(selectedProduct.selling_price) > 0
                      ? (((Number(selectedProduct.selling_price) - Number(selectedProduct.cost_price)) / Number(selectedProduct.selling_price)) * 100).toFixed(2)
                      : '0.00'}%
                  </span>
                </div>
              </div>

              <div>
                <span className="text-caption text-shade-50 block font-semibold">Description</span>
                <p className="text-shade-60 text-sm mt-1 leading-relaxed bg-canvas-cream/20 p-2.5 rounded border border-hairline-light">
                  {selectedProduct.description || 'No description provided.'}
                </p>
              </div>

              {/* Product Inventory logs */}
              <div className="border-t border-hairline-light pt-4 mt-6">
                <h4 className="font-display text-heading-sm font-semibold text-ink mb-3">Audit Log History</h4>
                {logsLoading ? (
                  <div className="flex justify-center items-center py-6">
                    <svg className="animate-spin h-5 w-5 text-shade-60" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : productLogs.length === 0 ? (
                  <p className="text-caption text-shade-50">No stock movements logged for this product.</p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {productLogs.slice().reverse().map(log => {
                      const isAddition = log.quantity_changed > 0;
                      return (
                        <div key={log.id} className="p-2.5 rounded border border-hairline-light text-caption flex justify-between bg-canvas-light">
                          <div>
                            <span className={`font-semibold ${isAddition ? 'text-green-700' : 'text-red-700'}`}>
                              {isAddition ? '+' : ''}{log.quantity_changed} {log.change_type}
                            </span>
                            <div className="text-micro text-shade-50 font-mono mt-0.5">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-shade-60 block">Bal: {log.new_quantity}</span>
                            <span className="text-micro text-shade-40">by User #{log.performed_by || 'system'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-lg w-full p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4">
              <h3 className="font-display text-heading-md font-semibold text-ink">Add New Product</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-shade-60 hover:text-ink font-semibold cursor-pointer">✕</button>
            </div>
            
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium">{formError}</div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-body-md text-ink">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-caption font-semibold">Product Name *</label>
                  <input type="text" name="name" required value={form.name} onChange={handleInputChange} placeholder="e.g. Wireless Mouse" className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">SKU Code *</label>
                  <input type="text" name="sku" required value={form.sku} onChange={handleInputChange} placeholder="e.g. ELEC-001" className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Barcode</label>
                  <input type="text" name="barcode" value={form.barcode} onChange={handleInputChange} placeholder="Optional barcode" className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" />
                </div>

                {/* Category Select + Quick Add */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-caption font-semibold">Category *</label>
                    <button 
                      type="button" 
                      onClick={() => { setQuickError(''); setQuickCategoryModal(true); }}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      + New Category
                    </button>
                  </div>
                  <select 
                    name="category_id" 
                    required 
                    value={form.category_id} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {categories.length === 0 && (
                    <p className="text-micro text-amber-600">No categories found. Click + New Category above.</p>
                  )}
                </div>

                {/* Supplier Select + Quick Add */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-caption font-semibold">Supplier *</label>
                    <button 
                      type="button" 
                      onClick={() => { setQuickError(''); setQuickSupplierModal(true); }}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      + New Supplier
                    </button>
                  </div>
                  <select 
                    name="supplier_id" 
                    required 
                    value={form.supplier_id} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {suppliers.length === 0 && (
                    <p className="text-micro text-amber-600">No suppliers found. Click + New Supplier above.</p>
                  )}
                </div>

                {/* Cost Price input with min=0 validation */}
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Cost Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    name="cost_price" 
                    required 
                    onKeyDown={preventMinus}
                    value={form.cost_price} 
                    onChange={handleInputChange} 
                    placeholder="0.00" 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                </div>

                {/* Selling Price input with min=0 validation */}
                <div className="space-y-1">
                  <label className="text-caption font-semibold">Selling Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    name="selling_price" 
                    required 
                    onKeyDown={preventMinus}
                    value={form.selling_price} 
                    onChange={handleInputChange} 
                    placeholder="0.00" 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Initial Quantity *</label>
                  <input 
                    type="number" 
                    min="0" 
                    name="quantity" 
                    required 
                    onKeyDown={preventMinus}
                    value={form.quantity} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Reorder Threshold *</label>
                  <input 
                    type="number" 
                    min="0" 
                    name="reorder_level" 
                    required 
                    onKeyDown={preventMinus}
                    value={form.reorder_level} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-caption font-semibold">Description</label>
                  <textarea name="description" value={form.description} onChange={handleInputChange} className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" rows="2" placeholder="Optional details..." />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setAddModalOpen(false)} className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer">
                  {submitting ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-lg w-full p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4">
              <h3 className="font-display text-heading-md font-semibold text-ink">Edit Product: {editProduct.name}</h3>
              <button onClick={() => setEditProduct(null)} className="text-shade-60 hover:text-ink font-semibold cursor-pointer">✕</button>
            </div>
            
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium">{formError}</div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-body-md text-ink">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-caption font-semibold">Product Name *</label>
                  <input type="text" name="name" required value={form.name} onChange={handleInputChange} className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">SKU Code (Read Only)</label>
                  <input type="text" name="sku" disabled value={form.sku} className="px-3 py-2 bg-canvas-cream/50 border border-hairline-light rounded w-full cursor-not-allowed font-mono" />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Barcode</label>
                  <input type="text" name="barcode" value={form.barcode} onChange={handleInputChange} className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-caption font-semibold">Category *</label>
                    <button 
                      type="button" 
                      onClick={() => { setQuickError(''); setQuickCategoryModal(true); }}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      + New Category
                    </button>
                  </div>
                  <select name="category_id" required value={form.category_id} onChange={handleInputChange} className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink">
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-caption font-semibold">Supplier *</label>
                    <button 
                      type="button" 
                      onClick={() => { setQuickError(''); setQuickSupplierModal(true); }}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      + New Supplier
                    </button>
                  </div>
                  <select name="supplier_id" required value={form.supplier_id} onChange={handleInputChange} className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink">
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Cost Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    name="cost_price" 
                    required 
                    onKeyDown={preventMinus}
                    value={form.cost_price} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Selling Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    name="selling_price" 
                    required 
                    onKeyDown={preventMinus}
                    value={form.selling_price} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Current Quantity (Locked)</label>
                  <input type="number" disabled value={form.quantity} className="px-3 py-2 bg-canvas-cream/50 border border-hairline-light rounded w-full cursor-not-allowed font-mono text-shade-50" />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold">Reorder Threshold *</label>
                  <input 
                    type="number" 
                    min="0" 
                    name="reorder_level" 
                    required 
                    onKeyDown={preventMinus}
                    value={form.reorder_level} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-caption font-semibold">Description</label>
                  <textarea name="description" value={form.description} onChange={handleInputChange} className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" rows="2" />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setEditProduct(null)} className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-hairline-light pb-4">
              <h3 className="font-display text-heading-md font-semibold text-ink">Adjust Stock</h3>
              <button onClick={() => setAdjustProduct(null)} className="text-shade-60 hover:text-ink font-semibold cursor-pointer">✕</button>
            </div>
            
            <div>
              <p className="text-body-strong font-semibold">{adjustProduct.name}</p>
              <p className="text-caption text-shade-50 mt-0.5">Current Stock Level: <span className="font-mono text-ink font-semibold">{adjustProduct.quantity}</span></p>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium">{formError}</div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-body-md text-ink">
              <div className="space-y-1">
                <label className="text-caption font-semibold">Adjustment Quantity *</label>
                <input 
                  type="number" 
                  name="quantity_changed" 
                  required 
                  placeholder="e.g. +10 or -5"
                  value={adjustForm.quantity_changed} 
                  onChange={handleAdjustInputChange} 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">Reason / Type *</label>
                <select 
                  name="change_type" 
                  required 
                  value={adjustForm.change_type} 
                  onChange={handleAdjustInputChange} 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                >
                  <option value="ADJUSTMENT">Manual Stock Audit (ADJUSTMENT)</option>
                  <option value="DAMAGE">Damaged / Expired Inventory (DAMAGE)</option>
                  <option value="RETURN">Customer Return (RETURN)</option>
                  <option value="PURCHASE">Direct Purchase (PURCHASE)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setAdjustProduct(null)} className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary hover:bg-shade-70 text-on-primary rounded-full font-semibold cursor-pointer">
                  {submitting ? 'Applying...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Category Creation Modal */}
      {quickCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-hairline-light pb-3">
              <h4 className="font-display font-semibold text-ink text-heading-sm">Quick Add Category</h4>
              <button onClick={() => setQuickCategoryModal(false)} className="text-shade-60 hover:text-ink font-semibold cursor-pointer">✕</button>
            </div>

            {quickError && (
              <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs">{quickError}</div>
            )}

            <form onSubmit={handleCreateQuickCategory} className="space-y-3 text-body-md text-ink">
              <div className="space-y-1">
                <label className="text-caption font-semibold">Category Name *</label>
                <input 
                  type="text" 
                  required 
                  value={quickCategoryName} 
                  onChange={(e) => setQuickCategoryName(e.target.value)} 
                  placeholder="e.g. Electronics, Hardware" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">Description</label>
                <textarea 
                  value={quickCategoryDesc} 
                  onChange={(e) => setQuickCategoryDesc(e.target.value)} 
                  placeholder="Optional notes..." 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                  rows="2"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-hairline-light">
                <button type="button" onClick={() => setQuickCategoryModal(false)} className="px-4 py-1.5 border border-hairline-light rounded-full text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={quickSubmitting} className="px-4 py-1.5 bg-primary hover:bg-shade-70 text-on-primary rounded-full text-xs font-semibold cursor-pointer">
                  {quickSubmitting ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Supplier Creation Modal */}
      {quickSupplierModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-hairline-light pb-3">
              <h4 className="font-display font-semibold text-ink text-heading-sm">Quick Add Supplier</h4>
              <button onClick={() => setQuickSupplierModal(false)} className="text-shade-60 hover:text-ink font-semibold cursor-pointer">✕</button>
            </div>

            {quickError && (
              <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs">{quickError}</div>
            )}

            <form onSubmit={handleCreateQuickSupplier} className="space-y-3 text-body-md text-ink">
              <div className="space-y-1">
                <label className="text-caption font-semibold">Supplier Name *</label>
                <input 
                  type="text" 
                  required 
                  value={quickSupplierName} 
                  onChange={(e) => setQuickSupplierName(e.target.value)} 
                  placeholder="e.g. Acme Corp" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">Phone Number (10+ digits) *</label>
                <input 
                  type="tel" 
                  required 
                  value={quickSupplierPhone} 
                  onChange={(e) => setQuickSupplierPhone(e.target.value)} 
                  placeholder="e.g. 9876543210" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">Email</label>
                <input 
                  type="email" 
                  value={quickSupplierEmail} 
                  onChange={(e) => setQuickSupplierEmail(e.target.value)} 
                  placeholder="vendor@example.com" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold">GST Number (Optional)</label>
                <input 
                  type="text" 
                  value={quickSupplierGst} 
                  onChange={(e) => setQuickSupplierGst(e.target.value)} 
                  placeholder="e.g. 22AAAAA0000A1Z5" 
                  className="px-3 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono uppercase"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-hairline-light">
                <button type="button" onClick={() => setQuickSupplierModal(false)} className="px-4 py-1.5 border border-hairline-light rounded-full text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={quickSubmitting} className="px-4 py-1.5 bg-primary hover:bg-shade-70 text-on-primary rounded-full text-xs font-semibold cursor-pointer">
                  {quickSubmitting ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={() => setDeleteProduct(null)}>
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-xl space-y-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <h3 className="font-display text-heading-md font-semibold text-ink">Delete Product?</h3>
            <p className="text-body-md text-shade-60 pb-2">
              Are you sure you want to delete <strong>{deleteProduct.name}</strong>? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium text-left mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex justify-center space-x-3 pt-2">
              <button 
                onClick={() => setDeleteProduct(null)} 
                disabled={isDeleting}
                className="px-6 py-2 border border-hairline-light rounded-full text-ink hover:bg-canvas-cream/50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteProduct} 
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

export default ProductsPage;
