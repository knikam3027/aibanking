import { useState, useEffect } from 'react';
import { getAdminUsers, adminAddBalance, adminAddBalanceBulk, getAdminBankBalance } from '../services/api';
import { FiSearch, FiDollarSign, FiCheck, FiX, FiUsers, FiSend } from 'react-icons/fi';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [bankBalance, setBankBalance] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkAmount, setBulkAmount] = useState('');
  const [singleModal, setSingleModal] = useState(null); // { userId, name }
  const [singleAmount, setSingleAmount] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(users);
    } else {
      const q = search.toLowerCase();
      setFiltered(users.filter(u =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
        u.account?.accountNumber?.includes(q)
      ));
    }
  }, [search, users]);

  const fetchData = async () => {
    try {
      const [usersRes, balRes] = await Promise.all([getAdminUsers(), getAdminBankBalance()]);
      setUsers(usersRes.data);
      setFiltered(usersRes.data);
      setBankBalance(balRes.data.balance);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => {
    if (selectedUsers.length === filtered.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filtered.map(u => u._id));
    }
  };

  const handleSingleAdd = async () => {
    if (!singleAmount || Number(singleAmount) <= 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { data } = await adminAddBalance({
        userId: singleModal._id,
        amount: Number(singleAmount),
        description: description || undefined,
      });
      setMessage({ type: 'success', text: data.message });
      setBankBalance(data.bankNewBalance);
      setSingleModal(null);
      setSingleAmount('');
      setDescription('');
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add balance.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkAmount || Number(bulkAmount) <= 0 || selectedUsers.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const usersPayload = selectedUsers.map(userId => ({ userId, amount: Number(bulkAmount) }));
      const { data } = await adminAddBalanceBulk({ users: usersPayload, description: description || undefined });
      setMessage({ type: 'success', text: data.message });
      setBankBalance(data.bankNewBalance);
      setSelectedUsers([]);
      setBulkAmount('');
      setDescription('');
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Bulk transfer failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-500 mt-1">Add balance to single or multiple users</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          <p className="text-xs text-emerald-600">Bank Reserve</p>
          <p className="text-lg font-bold text-emerald-700">₹{bankBalance.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedUsers.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <FiUsers className="text-indigo-600" size={18} />
              <span className="text-sm font-medium text-indigo-700">{selectedUsers.length} user(s) selected</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="number"
                placeholder="Amount per user"
                value={bulkAmount}
                onChange={(e) => setBulkAmount(e.target.value)}
                className="px-3 py-2 border border-indigo-200 rounded-lg text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                min="1"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-3 py-2 border border-indigo-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={handleBulkAdd}
                disabled={submitting || !bulkAmount}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <FiSend size={14} />
                {submitting ? 'Sending...' : `Send ₹${bulkAmount || 0} × ${selectedUsers.length}`}
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="text-gray-500 hover:text-gray-700 text-sm cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
          {bulkAmount && selectedUsers.length > 0 && (
            <p className="text-xs text-indigo-500 mt-2">
              Total: ₹{(Number(bulkAmount) * selectedUsers.length).toLocaleString('en-IN')} will be deducted from bank reserve
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search users by name, email, or account number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Account No</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((user) => (
                <tr key={user._id} className={`hover:bg-gray-50 ${selectedUsers.includes(user._id) ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user._id)}
                      onChange={() => toggleSelect(user._id)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{user.account?.accountNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600">
                      {user.account?.accountType || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ₹{user.account?.balance?.toLocaleString('en-IN') || '0'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSingleModal(user)}
                      className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-100 cursor-pointer flex items-center gap-1 mx-auto"
                    >
                      <FiDollarSign size={12} />
                      Add Balance
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-400">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single User Add Balance Modal */}
      {singleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSingleModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Balance</h3>
              <button onClick={() => setSingleModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <FiX size={20} />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900">{singleModal.name}</p>
              <p className="text-xs text-gray-500">{singleModal.email}</p>
              <p className="text-xs text-gray-400 mt-1">Account: {singleModal.account?.accountNumber} | Current: ₹{singleModal.account?.balance?.toLocaleString('en-IN')}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={singleAmount}
                  onChange={(e) => setSingleAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  min="1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Bonus credit"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <p className="text-xs text-gray-400">Bank reserve: ₹{bankBalance.toLocaleString('en-IN')}</p>
              <button
                onClick={handleSingleAdd}
                disabled={submitting || !singleAmount || Number(singleAmount) <= 0}
                className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <FiCheck size={16} />
                {submitting ? 'Processing...' : `Add ₹${Number(singleAmount || 0).toLocaleString('en-IN')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
