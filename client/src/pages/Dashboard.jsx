import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAccountDetails, getTransactions, getAlerts, predictBalance, getCashFlow } from '../services/api';
import { FiArrowUpRight, FiArrowDownLeft, FiAlertTriangle, FiTrendingUp, FiSend, FiMessageSquare, FiShield, FiActivity } from 'react-icons/fi';

export default function Dashboard() {
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, txnRes, alertRes, predRes, cfRes] = await Promise.all([
          getAccountDetails(),
          getTransactions(),
          getAlerts(),
          predictBalance(),
          getCashFlow().catch(() => ({ data: null })),
        ]);
        setAccount(accRes.data);
        setTransactions(txnRes.data.slice(0, 5));
        setAlerts(alertRes.data.filter(a => !a.read).slice(0, 3));
        setPrediction(predRes.data);
        setCashFlow(cfRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance card */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <p className="text-indigo-100 text-sm">Account Balance</p>
          <p className="text-3xl font-bold mt-1">₹{account?.balance?.toLocaleString('en-IN') || '0'}</p>
          <p className="text-indigo-200 text-xs mt-2">
            A/C: {account?.accountNumber || 'N/A'} • {account?.accountType || 'savings'}
          </p>
        </div>

        {/* Prediction card */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <FiTrendingUp />
            <span className="text-sm font-medium">AI Prediction</span>
          </div>
          {prediction ? (
            <>
              <p className="text-sm text-gray-700">{prediction.warning}</p>
              <p className="text-xs text-gray-500 mt-2">
                Avg. daily spending: ₹{prediction.avg_daily_spending?.toLocaleString('en-IN')}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">No prediction available yet.</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/transfer" className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition no-underline">
              <FiSend size={14} /> Transfer
            </Link>
            <Link to="/chat" className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition no-underline">
              <FiMessageSquare size={14} /> AI Chat
            </Link>
          </div>
        </div>
      </div>

      {/* Financial Health Score & Cash Flow */}
      {cashFlow && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Health Score */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiShield className="text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Financial Health Score</h3>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none"
                    stroke={cashFlow.healthScore >= 70 ? '#22c55e' : cashFlow.healthScore >= 40 ? '#eab308' : '#ef4444'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${cashFlow.healthScore * 2.51} 251`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-900">
                  {cashFlow.healthScore}
                </span>
              </div>
              <div className="flex-1 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Savings Rate</span>
                  <span className="font-medium">{cashFlow.savingsRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Surplus</span>
                  <span className={`font-medium ${cashFlow.monthlySurplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{cashFlow.monthlySurplus?.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Days Until Low</span>
                  <span className="font-medium">{cashFlow.daysUntilLow > 90 ? '90+' : cashFlow.daysUntilLow} days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cash Flow Projection */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiActivity className="text-purple-600" />
              <h3 className="font-semibold text-gray-900">30-Day Cash Flow</h3>
            </div>
            <div className="space-y-1">
              {cashFlow.projection?.filter((_, i) => i % 5 === 0 || i === cashFlow.projection.length - 1).map((p) => (
                <div key={p.day} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-14">Day {p.day}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.balance > 0 ? 'bg-indigo-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, Math.max(2, (p.balance / (cashFlow.projection[0]?.balance || 1)) * 100))}%` }}
                    />
                  </div>
                  <span className="text-gray-700 w-20 text-right font-medium">₹{p.balance?.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            {cashFlow.spendingByCategory && Object.keys(cashFlow.spendingByCategory).length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Top Spending Categories</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(cashFlow.spendingByCategory).sort(([,a],[,b]) => b - a).slice(0, 4).map(([cat, amt]) => (
                    <span key={cat} className="px-2 py-1 bg-gray-50 rounded-md text-xs text-gray-700">
                      {cat}: ₹{amt.toLocaleString('en-IN')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <FiAlertTriangle /> Alerts ({alerts.length})
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert._id} className="flex items-start gap-2 text-sm">
                <span className={`inline-block w-2 h-2 rounded-full mt-1.5 ${
                  alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <span className="text-red-800">{alert.message}</span>
              </div>
            ))}
          </div>
          <Link to="/alerts" className="text-red-600 text-sm font-medium mt-2 inline-block hover:underline">
            View all alerts →
          </Link>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
          <Link to="/transactions" className="text-indigo-600 text-sm font-medium hover:underline">View all</Link>
        </div>
        {transactions.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm text-center">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map((txn) => (
              <div key={txn._id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    txn.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {txn.type === 'credit' ? <FiArrowDownLeft size={16} /> : <FiArrowUpRight size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {txn.type === 'debit' ? txn.receiver || txn.description : txn.sender || txn.description || 'Credit'}
                    </p>
                    <p className="text-xs text-gray-500">{txn.category} • {new Date(txn.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.type === 'credit' ? '+' : '-'}₹{txn.amount?.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
