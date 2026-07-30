import Sidebar from './Sidebar';
import Header from './Header';
import { Outlet, Navigate } from 'react-router-dom';

/**
 * Main application layout container.
 * Uses a CSS grid to create the sidebar and main content areas.
 * The sidebar has a fixed width (240px), and the main content area fills the remaining space.
 */
const AppLayout = () => {
  const token = localStorage.getItem('token');

  // Guard: if user is not logged in, redirect to login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-canvas-cream">
      <div className="col-span-1 border-r border-hairline-light">
        <Sidebar />
      </div>

      <div className="col-span-1 flex flex-col">
        <Header />
        <main className="flex-grow p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
