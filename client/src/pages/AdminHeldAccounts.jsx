import { useState, useEffect } from 'react';
import { adminGetHeldAccounts, adminUnholdAccount } from '../services/api';
import { FiShield, FiUnlock, FiRotateCcw, FiAlertTriangle, FiUser, FiClock, FiDollarSign, FiRefreshCw } from 'react-icons/fi';

export default function AdminHeldAccounts() {
  const [heldAccounts, setHeldAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState('');

  const fetchHeldAccounts = async () => {
    setLoading(true);
    try {
      const { data } = await adminGetHeldAccounts();
      setHeldAccounts(data);
    } catch {
      setMessage('Failed to load held accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHeldAccounts(); }, []);

  const handleUnhold = async (accountId, action) => {
    setActionLoading(accountId);
    setMessage('');
    try {
      const { data } = await adminUnholdAccount(accountId, {
        action,
        notes: notes[accountId] || '',
      });
      setMessage(data.message);
      fetchHeldAccounts();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FiShield className="text-red-600" /> Held Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Accounts flagged as suspicious via post-transfer voice verification (transfers &gt; ₹1,00,000)
          </p>
        </div>
        <button onClick={fetchHeldAccounts} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition text-sm cursor-pointer">
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">{message}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-500">Loading held accounts...</div>
      )}

      {/* Empty state */}
      {!loading && heldAccounts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FiShield className="mx-auto text-green-500 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700">No Held Accounts</h3>
          <p className="text-sm text-gray-500 mt-1">All accounts are currently active. No security holds pending.</p>
        </div>
      )}

      {/* Held accounts list */}
      {!loading && heldAccounts.map((acc) => (
        <div key={acc._id} className="bg-white rounded-xl border-2 border-red-200 overflow-hidden">
          {/* Red banner */}
          <div className="bg-red-50 px-6 py-3 flex items-center justify-between border-b border-red-200">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
              <FiAlertTriangle size={16} />
              ACCOUNT HELD — Pending Admin Review
            </div>
            <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              {acc.heldAt ? new Date(acc.heldAt).toLocaleString('en-IN') : 'Unknown time'}
            </span>
          </div>

          <div className="p-6 space-y-4">
            {/* User info */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <FiUser className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{acc.user?.name || 'Unknown'}</h3>
                  <p className="text-sm text-gray-500">{acc.user?.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Phone: {acc.user?.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Account</p>
                <p className="font-mono font-semibold text-gray-800">{acc.accountNumber}</p>
                <p className="text-sm text-gray-600 mt-1">Balance: <strong>₹{acc.balance?.toLocaleString('en-IN')}</strong></p>
              </div>
            </div>

            {/* Hold reason */}
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <p className="text-sm font-medium text-yellow-800 mb-1">Hold Reason:</p>
              <p className="text-sm text-yellow-700">{acc.heldReason || 'Suspicious activity detected via voice verification.'}</p>
            </div>

            {/* Suspicious transaction details */}
            {acc.verification && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <FiDollarSign size={14} /> Flagged Transaction
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="font-semibold text-red-700">₹{acc.verification.amount?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">To Account</p>
                    <p className="font-mono">{acc.verification.receiverAccount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Beneficiary</p>
                    <p>{acc.verification.beneficiaryName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Time</p>
                    <p>{new Date(acc.verification.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (optional)</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                placeholder="Add review notes before taking action..."
                value={notes[acc._id] || ''}
                onChange={(e) => setNotes({ ...notes, [acc._id]: e.target.value })}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleUnhold(acc._id, 'unhold')}
                disabled={actionLoading === acc._id}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FiUnlock size={16} />
                {actionLoading === acc._id ? 'Processing...' : 'Clear & Unhold Account'}
              </button>
              <button
                onClick={() => handleUnhold(acc._id, 'reverse_transaction')}
                disabled={actionLoading === acc._id}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FiRotateCcw size={16} />
                {actionLoading === acc._id ? 'Processing...' : 'Reverse Transaction & Unhold'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
