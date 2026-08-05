import { useState, useEffect } from 'react';
import client from '../api/client';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [settings, setSettings] = useState({
    org_name: '',
    org_email: '',
    org_phone: '',
    org_address: '',
    currency_symbol: '₹',
    default_tax_rate: '0',
    low_stock_threshold: '5',
    dead_stock_days: '30',
    email_alerts_enabled: 'false'
  });

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  // User Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, usersRes, rolesRes] = await Promise.all([
        client.get('/settings/'),
        client.get('/auth/users').catch(() => ({ data: [] })),
        client.get('/auth/roles').catch(() => ({ data: [] }))
      ]);
      
      if (settingsRes.data) {
        setSettings(prev => ({
          ...prev,
          ...settingsRes.data
        }));
      }
      if (usersRes.data) {
        setUsers(usersRes.data);
      }
      if (rolesRes.data) {
        setRoles(rolesRes.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load settings data.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await client.put('/settings/', { settings });
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  // User Handlers
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await client.post('/auth/register', {
        ...userForm,
        role_id: Number(userForm.role_id)
      });
      setUserModalOpen(false);
      setSuccess('User created successfully.');
      fetchData();
      setUserForm({ username: '', email: '', password: '', role_id: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user.');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        role_id: Number(userForm.role_id)
      };
      if (userForm.password) {
        payload.password = userForm.password;
      }
      await client.put(`/auth/users/${selectedUser.id}`, payload);
      setEditModalOpen(false);
      setSuccess('User updated successfully.');
      fetchData();
      setSelectedUser(null);
      setUserForm({ username: '', email: '', password: '', role_id: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update user.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      await client.delete(`/auth/users/${userId}`);
      setSuccess('User deleted successfully.');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user.');
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    // Find role_id from string
    const roleObj = roles.find(r => r.name === user.role_name);
    setUserForm({
      username: user.username,
      email: user.email,
      password: '',
      role_id: roleObj ? roleObj.id : ''
    });
    setEditModalOpen(true);
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

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-display-md font-display font-light text-ink tracking-tight">Settings</h2>
        <p className="text-caption text-shade-50">Customize organization profile, user roles, and system preferences.</p>
      </div>

      <div className="flex space-x-8 border-b border-hairline-light mb-6 overflow-x-auto pb-1">
        {[
          { id: 'profile', label: 'Organization Profile' },
          { id: 'preferences', label: 'General Preferences' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'users', label: 'Users & Roles' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setError(''); setSuccess(''); setActiveTab(tab.id); }}
            className={`py-3 text-body-md font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-ink font-semibold' : 'border-transparent text-shade-40 hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm">{success}</div>}

      <div className="bg-canvas-light p-6 rounded-lg border border-hairline-light shadow-[0_8px_8px_rgba(0,0,0,0.02),_0_0_0_1px_rgba(0,0,0,0.02)]">
        
        {/* ORGANIZATION PROFILE TAB */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <h3 className="font-display text-heading-md font-semibold text-ink border-b border-hairline-light pb-2">Organization Profile</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-caption font-semibold block text-ink">Organization Name</label>
                <input 
                  type="text" 
                  name="org_name" 
                  value={settings.org_name || ''} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Acme Corp" 
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-caption font-semibold block text-ink">Contact Email</label>
                <input 
                  type="email" 
                  name="org_email" 
                  value={settings.org_email || ''} 
                  onChange={handleInputChange} 
                  placeholder="e.g. contact@acmecorp.com" 
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-caption font-semibold block text-ink">Phone Number</label>
                <input 
                  type="text" 
                  name="org_phone" 
                  value={settings.org_phone || ''} 
                  onChange={handleInputChange} 
                  placeholder="e.g. +91 98765 43210" 
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink" 
                />
              </div>
              
              <div className="space-y-1 md:col-span-2">
                <label className="text-caption font-semibold block text-ink">Address</label>
                <textarea 
                  name="org_address" 
                  value={settings.org_address || ''} 
                  onChange={handleInputChange} 
                  rows={3}
                  placeholder="Enter full address..." 
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink resize-none" 
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-hairline-light">
              <button 
                type="submit" 
                disabled={saving}
                className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        {/* GENERAL PREFERENCES TAB */}
        {activeTab === 'preferences' && (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <h3 className="font-display text-heading-md font-semibold text-ink border-b border-hairline-light pb-2">General Preferences</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-caption font-semibold block text-ink">Currency Symbol</label>
                <input 
                  type="text" 
                  name="currency_symbol" 
                  value={settings.currency_symbol || ''} 
                  onChange={handleInputChange} 
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-caption font-semibold block text-ink">Default Tax Rate (%)</label>
                <input 
                  type="number" 
                  name="default_tax_rate" 
                  min="0"
                  step="0.01"
                  value={settings.default_tax_rate || ''} 
                  onChange={handleInputChange} 
                  className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-hairline-light">
              <button 
                type="submit" 
                disabled={saving}
                className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </form>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <h3 className="font-display text-heading-md font-semibold text-ink border-b border-hairline-light pb-2">Notification Configurations</h3>
            
            <div className="grid grid-cols-1 gap-6">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox"
                  id="email_alerts_enabled"
                  name="email_alerts_enabled"
                  checked={settings.email_alerts_enabled === 'true'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-primary focus:ring-primary border-hairline-light rounded cursor-pointer"
                />
                <label htmlFor="email_alerts_enabled" className="text-body-md font-semibold text-ink cursor-pointer">Enable Email Alerts for Low Stock</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-hairline-light/50">
                <div className="space-y-1">
                  <label className="text-caption font-semibold block text-ink">Global Low Stock Threshold</label>
                  <input 
                    type="number" 
                    name="low_stock_threshold" 
                    min="1"
                    value={settings.low_stock_threshold || ''} 
                    onChange={handleInputChange} 
                    className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                  <p className="text-micro text-shade-40 mt-1">Default reorder level when creating new products.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-semibold block text-ink">Dead Stock Analysis Window (Days)</label>
                  <input 
                    type="number" 
                    name="dead_stock_days" 
                    min="1"
                    value={settings.dead_stock_days || ''} 
                    onChange={handleInputChange} 
                    className="px-4 py-2 bg-canvas-light border border-hairline-light rounded w-full focus:outline-none focus:ring-1 focus:ring-ink font-mono" 
                  />
                  <p className="text-micro text-shade-40 mt-1">Used in the dashboard to identify slow-moving items.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-hairline-light">
              <button 
                type="submit" 
                disabled={saving}
                className="px-xl py-2.5 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Configurations'}
              </button>
            </div>
          </form>
        )}

        {/* USERS & ROLES TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-hairline-light pb-2">
              <h3 className="font-display text-heading-md font-semibold text-ink">Users & Roles</h3>
              <button 
                onClick={() => {
                  setUserForm({ username: '', email: '', password: '', role_id: '' });
                  setUserModalOpen(true);
                }}
                className="px-4 py-1.5 text-body-sm font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors cursor-pointer"
              >
                + Create User
              </button>
            </div>
            
            {users.length === 0 ? (
              <p className="text-caption text-shade-50 py-8 text-center">No users found or you lack administrative privileges.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-hairline-light text-caption font-semibold text-shade-60 bg-canvas-cream/30">
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4 text-center">Role</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-canvas-cream/20">
                        <td className="py-3 px-4 font-mono font-medium">{user.id}</td>
                        <td className="py-3 px-4 font-semibold text-ink">{user.username}</td>
                        <td className="py-3 px-4 text-shade-60">{user.email}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${user.role_name?.toLowerCase() === 'admin' ? 'bg-primary/10 text-primary' : 'bg-canvas-cream border border-hairline-light text-ink'}`}>
                            {user.role_name || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-3">
                          <button onClick={() => openEditModal(user)} className="text-primary hover:text-shade-70 font-semibold text-xs cursor-pointer">Edit</button>
                          <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs cursor-pointer">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {userModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-hairline-light pb-2">
              <h3 className="font-display text-heading-md font-semibold text-ink">Create New User</h3>
              <button onClick={() => setUserModalOpen(false)} className="text-shade-60 hover:text-ink cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-caption font-semibold">Username *</label>
                <input required type="text" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-3 py-2 bg-canvas-light border border-hairline-light rounded focus:outline-none focus:ring-1 focus:ring-ink" />
              </div>
              <div className="space-y-1">
                <label className="text-caption font-semibold">Email *</label>
                <input required type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full px-3 py-2 bg-canvas-light border border-hairline-light rounded focus:outline-none focus:ring-1 focus:ring-ink" />
              </div>
              <div className="space-y-1">
                <label className="text-caption font-semibold">Password *</label>
                <input required type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-3 py-2 bg-canvas-light border border-hairline-light rounded focus:outline-none focus:ring-1 focus:ring-ink" minLength={8} />
              </div>
              <div className="space-y-1">
                <label className="text-caption font-semibold">Role *</label>
                <select required value={userForm.role_id} onChange={e => setUserForm({...userForm, role_id: e.target.value})} className="w-full px-3 py-2 bg-canvas-light border border-hairline-light rounded focus:outline-none focus:ring-1 focus:ring-ink">
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setUserModalOpen(false)} className="px-4 py-2 rounded-full border border-hairline-light text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-full bg-primary hover:bg-shade-70 text-on-primary font-semibold cursor-pointer">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-canvas-light rounded-lg border border-hairline-light max-w-sm w-full p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-hairline-light pb-2">
              <h3 className="font-display text-heading-md font-semibold text-ink">Edit User: {selectedUser.username}</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-shade-60 hover:text-ink cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-caption font-semibold">New Password</label>
                <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-3 py-2 bg-canvas-light border border-hairline-light rounded focus:outline-none focus:ring-1 focus:ring-ink" placeholder="Leave blank to keep current" minLength={8} />
              </div>
              <div className="space-y-1">
                <label className="text-caption font-semibold">Role *</label>
                <select required value={userForm.role_id} onChange={e => setUserForm({...userForm, role_id: e.target.value})} className="w-full px-3 py-2 bg-canvas-light border border-hairline-light rounded focus:outline-none focus:ring-1 focus:ring-ink">
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-hairline-light">
                <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded-full border border-hairline-light text-ink hover:bg-canvas-cream/50 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-full bg-primary hover:bg-shade-70 text-on-primary font-semibold cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
