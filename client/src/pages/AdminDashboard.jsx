import { useState, useEffect } from 'react';
import { getAdminDashboard } from '../services/api';
import { FiUsers, FiActivity, FiDollarSign, FiAlertTriangle, FiTrendingUp, FiUserPlus, FiShield } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await getAdminDashboard();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-red-500 py-8">Failed to load admin dashboard.</div>;
  }

  const statCards = [
    { label: 'Bank Reserve', value: `₹${stats.bankBalance?.toLocaleString('en-IN')}`, icon: FiDollarSign, color: 'bg-emerald-500', sub: 'Available bank balance' },
    { label: 'Total Users', value: stats.totalUsers, icon: FiUsers, color: 'bg-blue-500', sub: `+${stats.newUsersToday} today` },
    { label: 'Active Today', value: stats.activeUsersToday, icon: FiActivity, color: 'bg-purple-500', sub: 'Users with transactions' },
    { label: 'Total Transactions', value: stats.totalTransactions, icon: FiTrendingUp, color: 'bg-orange-500', sub: `${stats.todayTransactions} today` },
    { label: 'Money in System', value: `₹${stats.totalMoneyInSystem?.toLocaleString('en-IN')}`, icon: FiDollarSign, color: 'bg-teal-500', sub: 'All user accounts combined' },
    { label: 'Fraud Alerts', value: stats.fraudAlerts, icon: FiAlertTriangle, color: 'bg-red-500', sub: `${stats.todayBlocked} txns blocked today` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Bank operations overview & AI insights</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg">
          <FiShield size={18} />
          <span className="text-sm font-medium">Admin Mode</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
              <div className={`${card.color} p-2.5 rounded-lg text-white`}>
                <card.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Money Flow */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Money Flow</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600">Credited</p>
            <p className="text-xl font-bold text-green-700">₹{stats.todayCredited?.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-600">Debited</p>
            <p className="text-xl font-bold text-red-700">₹{stats.todayDebited?.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600">New Users Today</p>
            <p className="text-xl font-bold text-blue-700">{stats.newUsersToday}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-blue-500">
              <FiUserPlus size={12} /> registrations
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Transaction Volume */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Transaction Volume</h2>
          {stats.weeklyTxns?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.weeklyTxns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-8">No transaction data this week</p>
          )}
        </div>

        {/* Weekly User Registrations */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Registrations (7 Days)</h2>
          {stats.weeklyUsers?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.weeklyUsers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-8">No new registrations this week</p>
          )}
        </div>
      </div>

      {/* Top Users by Balance */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Users by Balance</h2>
        {stats.topUsers?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">#</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Account No</th>
                  <th className="pb-3 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.topUsers.map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-400">{i + 1}</td>
                    <td className="py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="py-3 text-gray-500">{u.email}</td>
                    <td className="py-3 text-gray-500 font-mono text-xs">{u.accountNumber}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">₹{u.balance?.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">No users yet</p>
        )}
      </div>

      {/* AI Insight Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-lg font-semibold mb-3">🤖 AI Banking Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="font-medium mb-1">User Activity Rate</p>
            <p className="text-2xl font-bold">
              {stats.totalUsers > 0 ? Math.round((stats.activeUsersToday / stats.totalUsers) * 100) : 0}%
            </p>
            <p className="text-white/70 text-xs mt-1">of users active today</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="font-medium mb-1">Avg Balance Per User</p>
            <p className="text-2xl font-bold">
              ₹{stats.totalUsers > 0 ? Math.round(stats.totalMoneyInSystem / stats.totalUsers).toLocaleString('en-IN') : 0}
            </p>
            <p className="text-white/70 text-xs mt-1">across all accounts</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="font-medium mb-1">Fraud Detection</p>
            <p className="text-2xl font-bold">{stats.blockedTransactions}</p>
            <p className="text-white/70 text-xs mt-1">total suspicious transactions blocked</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="font-medium mb-1">Today's Alerts</p>
            <p className="text-2xl font-bold">{stats.recentAlerts}</p>
            <p className="text-white/70 text-xs mt-1">{stats.fraudAlerts} fraud related</p>
          </div>
        </div>
      </div>
    </div>
  );
}
