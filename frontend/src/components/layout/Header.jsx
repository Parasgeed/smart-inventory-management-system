import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Header component for the main content area.
 * Displays page title and user actions.
 * Adheres to the light/transactional track design.
 */
const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
      case '/':
        return 'Dashboard';
      case '/products':
        return 'Products';
      case '/sales':
        return 'Sales';
      case '/purchases':
        return 'Purchases';
      case '/suppliers':
        return 'Suppliers';
      default:
        return 'Inventory Management';
    }
  };

  return (
    <header className="bg-canvas-light sticky top-0 z-10">
      <div className="flex items-center justify-between h-20 px-xl border-b border-hairline-light">
        <div>
          <h1 className="font-display text-heading-lg font-light text-ink">{getPageTitle()}</h1>
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
