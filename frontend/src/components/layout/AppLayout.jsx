import Sidebar from './Sidebar';
import Header from './Header';
import { Outlet, Navigate } from 'react-router-dom';

/**
 * Main application layout container.
 * Uses a fixed flex layout where the sidebar and header are pinned in place,
 * and only the main content area scrolls vertically.
 */
const AppLayout = () => {
  const token = localStorage.getItem('token');

  // Guard: if user is not logged in, redirect to login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-canvas-cream">
      {/* Fixed Sidebar */}
      <div className="w-[240px] flex-shrink-0 h-full border-r border-hairline-light z-20">
        <Sidebar />
      </div>

      {/* Main Content Area: Header pinned at top, Main scrolls */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
