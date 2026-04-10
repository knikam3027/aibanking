import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute, { AdminRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Transfer from './pages/Transfer';
import Loans from './pages/Loans';
import Insights from './pages/Insights';
import Chat from './pages/Chat';
import Alerts from './pages/Alerts';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminPayroll from './pages/AdminPayroll';
import AdminWithdraw from './pages/AdminWithdraw';
import AdminHeldAccounts from './pages/AdminHeldAccounts';

function ProtectedLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function AdminLayout({ children }) {
  return (
    <AdminRoute>
      <Layout>{children}</Layout>
    </AdminRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/transactions" element={<ProtectedLayout><Transactions /></ProtectedLayout>} />
          <Route path="/transfer" element={<ProtectedLayout><Transfer /></ProtectedLayout>} />
          <Route path="/loans" element={<ProtectedLayout><Loans /></ProtectedLayout>} />
          <Route path="/insights" element={<ProtectedLayout><Insights /></ProtectedLayout>} />
          <Route path="/chat" element={<ProtectedLayout><Chat /></ProtectedLayout>} />
          <Route path="/alerts" element={<ProtectedLayout><Alerts /></ProtectedLayout>} />
          <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
          <Route path="/admin/payroll" element={<AdminLayout><AdminPayroll /></AdminLayout>} />
          <Route path="/admin/withdraw" element={<AdminLayout><AdminWithdraw /></AdminLayout>} />
          <Route path="/admin/held-accounts" element={<AdminLayout><AdminHeldAccounts /></AdminLayout>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
