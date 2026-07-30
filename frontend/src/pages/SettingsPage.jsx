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
    dead_stock_days: '30'
  });

  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, usersRes] = await Promise.all([
        client.get('/settings/'),
        client.get('/auth/users').catch(() => ({ data: [] })) // Fallback if not admin
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
    } catch (err) {
      console.error(err);
      setError('Failed to load settings data.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
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

      <div className="flex space-x-8 border-b border-hairline-light mb-6">
        {[
          { id: 'profile', label: 'Organization Profile' },
          { id: 'preferences', label: 'General Preferences' },
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

        {/* USERS & ROLES TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-hairline-light pb-2">
              <h3 className="font-display text-heading-md font-semibold text-ink">Users & Roles</h3>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-light text-body-md text-ink">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-canvas-cream/20">
                        <td className="py-3 px-4 font-mono font-medium">{user.id}</td>
                        <td className="py-3 px-4 font-semibold text-ink">{user.username}</td>
                        <td className="py-3 px-4 text-shade-60">{user.email}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${user.role_name.toLowerCase() === 'admin' ? 'bg-primary/10 text-primary' : 'bg-canvas-cream border border-hairline-light text-ink'}`}>
                            {user.role_name}
                          </span>
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
    </div>
  );
}

export default SettingsPage;
