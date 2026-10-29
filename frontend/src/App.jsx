import { Routes, Route } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import SalesPage from './pages/SalesPage';
import SalesReturnsPage from './pages/SalesReturnsPage';
import PurchasesPage from './pages/PurchasesPage';
import PurchaseReturnsPage from './pages/PurchaseReturnsPage';
import SuppliersPage from './pages/SuppliersPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import PaymentsPage from './pages/PaymentsPage';
import ReportsPage from './pages/ReportsPage';
import ForecastingPage from './pages/ForecastingPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/sales-returns" element={<SalesReturnsPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/purchase-returns" element={<PurchaseReturnsPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/forecasting" element={<ForecastingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}


export default App;
