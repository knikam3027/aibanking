import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiSend, FiList, FiMessageSquare, FiBell, FiDollarSign, FiTrendingUp, FiLogOut, FiMenu, FiX, FiUsers, FiShield, FiFileText } from 'react-icons/fi';
import { useState } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userNavItems = [
    { path: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/transactions', icon: FiList, label: 'Transactions' },
    { path: '/transfer', icon: FiSend, label: 'Transfer' },
    { path: '/loans', icon: FiDollarSign, label: 'Loans' },
    { path: '/insights', icon: FiTrendingUp, label: 'Insights' },
    { path: '/chat', icon: FiMessageSquare, label: 'AI Chat' },
    { path: '/alerts', icon: FiBell, label: 'Alerts' },
  ];

  const adminNavItems = [
    { path: '/admin', icon: FiShield, label: 'Admin Dashboard' },
    { path: '/admin/users', icon: FiUsers, label: 'Manage Users' },
    { path: '/admin/payroll', icon: FiFileText, label: 'Salary Payroll' },
    { path: '/admin/withdraw', icon: FiDollarSign, label: 'Withdraw to Account' },
    { path: '/chat', icon: FiMessageSquare, label: 'AI Chat' },
    { path: '/alerts', icon: FiBell, label: 'Alerts' },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            🏦 AI Banking
          </h1>
          {user && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              {isAdmin && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
            </div>
          )}
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline ${
                location.pathname === path
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors cursor-pointer"
          >
            <FiLogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between lg:justify-end">
          <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
