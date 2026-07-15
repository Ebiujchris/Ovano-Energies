import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { can, isOwner } from './lib/permissions';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import StaffPage from './pages/StaffPage';
import SuppliersPage from './pages/SuppliersPage';
import ExpensesPage from './pages/ExpensesPage';
import ReceiptsPage from './pages/ReceiptsPage';
import CreditsPage from './pages/CreditsPage';
import RestockPage from './pages/RestockPage';
import SettingsPage from './pages/SettingsPage';
import BalanceSheetPage from './pages/BalanceSheetPage';
import CashFlowPage from './pages/CashFlowPage';
import IncomeComparisonPage from './pages/IncomeComparisonPage';
import CategoriesPage from './pages/CategoriesPage';

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
  </div>
);

const Denied = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50">
    <div className="rounded-2xl border border-red-200 bg-red-50 px-8 py-10 text-center max-w-sm">
      <p className="text-2xl mb-2">🔒</p>
      <p className="font-semibold text-slate-900 mb-1">Access restricted</p>
      <p className="text-sm text-slate-500">You don't have permission to view this page. Ask the owner to update your access.</p>
    </div>
  </div>
);

function ProtectedRoute({ children, permission, ownerOnly }: {
  children: React.ReactNode;
  permission?: string;
  ownerOnly?: boolean;
}) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (ownerOnly && !isOwner(user)) return <Denied />;
  if (permission && !can(user, permission)) return <Denied />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/sales"     element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
      <Route path="/receipts"  element={<ProtectedRoute><ReceiptsPage /></ProtectedRoute>} />
      <Route path="/expenses"  element={<ProtectedRoute permission="canManageExpenses"><ExpensesPage /></ProtectedRoute>} />
      <Route path="/credits"   element={<ProtectedRoute permission="canApproveCredits"><CreditsPage /></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      <Route path="/products"   element={<ProtectedRoute permission="canAccessInventory"><ProductsPage /></ProtectedRoute>} />
      <Route path="/categories"  element={<ProtectedRoute permission="canAccessInventory"><CategoriesPage /></ProtectedRoute>} />
      <Route path="/restock"    element={<ProtectedRoute permission="canAccessInventory"><RestockPage /></ProtectedRoute>} />
      <Route path="/suppliers"  element={<ProtectedRoute permission="canAccessInventory"><SuppliersPage /></ProtectedRoute>} />

      <Route path="/reports"           element={<ProtectedRoute permission="canViewReports"><ReportsPage /></ProtectedRoute>} />
      <Route path="/balance-sheet"     element={<ProtectedRoute permission="canViewReports"><BalanceSheetPage /></ProtectedRoute>} />
      <Route path="/cash-flow"         element={<ProtectedRoute permission="canViewReports"><CashFlowPage /></ProtectedRoute>} />
      <Route path="/income-comparison" element={<ProtectedRoute permission="canViewReports"><IncomeComparisonPage /></ProtectedRoute>} />

      <Route path="/staff" element={<ProtectedRoute ownerOnly><StaffPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
