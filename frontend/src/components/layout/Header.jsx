import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import client from '../../api/client';
import NotificationBell from '../notifications/NotificationBell';

/**
 * Header component for the main content area.
 * Displays page title, global search, and user actions.
 */
const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Get user details
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const initial = user?.username ? user.username.charAt(0).toUpperCase() : 'U';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Determine page title based on path
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/products': return 'Products';
      case '/sales': return 'Sales';
      case '/sales-returns': return 'Sales Returns';
      case '/purchases': return 'Purchases';
      case '/purchase-returns': return 'Purchase Returns';
      case '/suppliers': return 'Suppliers';
      case '/invoices': return 'Invoices';
      case '/payments': return 'Payments';
      case '/reports': return 'Reports';
      case '/settings': return 'Settings';
      default: return 'Inventory Management';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await client.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data.results || []);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      fetchSearchResults();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResultClick = (link) => {
    setShowDropdown(false);
    setSearchQuery('');
    navigate(link);
  };

  return (
    <header className="bg-canvas-light sticky top-0 z-10 flex-shrink-0">
      <div className="flex items-center justify-between h-20 px-xl border-b border-hairline-light">
        <div>
          <h1 className="font-display text-heading-lg font-light text-ink">{getPageTitle()}</h1>
        </div>

        {/* Global Search Bar */}
        <div className="flex-grow max-w-md mx-8 relative" ref={dropdownRef}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search products, orders, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowDropdown(true);
              }}
              className="w-full pl-10 pr-4 py-2 border border-hairline-light rounded-md bg-canvas-cream focus:outline-none focus:ring-1 focus:ring-primary text-body-md"
            />
            <div className="absolute left-3 top-2.5 text-shade-40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          {/* Search Dropdown */}
          {showDropdown && (searchQuery.length >= 2) && (
            <div className="absolute mt-1 w-full bg-canvas-light border border-hairline-light rounded-md shadow-lg max-h-96 overflow-y-auto z-50">
              {searchResults.length === 0 && !isSearching ? (
                <div className="p-4 text-center text-shade-50 text-body-md">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <ul className="py-2">
                  {searchResults.map((result) => (
                    <li 
                      key={`${result.type}-${result.id}`}
                      className="px-4 py-2 hover:bg-aloe-10 cursor-pointer flex flex-col transition-colors duration-150"
                      onClick={() => handleResultClick(result.link)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{result.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-shade-20 text-shade-70 uppercase tracking-wider">
                          {result.type.replace('_', ' ')}
                        </span>
                      </div>
                      {result.subtitle && (
                        <span className="text-caption text-shade-50 mt-1">{result.subtitle}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <div className="text-right hidden sm:block">
              <p className="text-body-strong text-ink leading-none">{user.username}</p>
              <p className="text-caption text-shade-50 mt-1">{user.email}</p>
            </div>
          )}
          <div className="w-10 h-10 bg-aloe-10 rounded-full flex items-center justify-center font-bold text-ink">
            {initial}
          </div>
          <NotificationBell />
          <button 
            onClick={handleLogout}
            className="px-xl py-2 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 transition-colors duration-200 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
