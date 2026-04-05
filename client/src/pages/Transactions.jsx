import { useState, useEffect } from 'react';
import { getTransactions } from '../services/api';
import { FiArrowUpRight, FiArrowDownLeft, FiFilter, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const PAGE_SIZE = 20;

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchTxns = async () => {
      try {
        const { data } = await getTransactions();
        setTransactions(data);
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTxns();
  }, []);

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{filtered.length} transactions</span>
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-500" />
            <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
          </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {filtered.length === 0 ? (
          <p className="p-8 text-gray-500 text-center">No transactions found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginated.map((txn) => (
              <div key={txn._id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    txn.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {txn.type === 'credit' ? <FiArrowDownLeft size={18} /> : <FiArrowUpRight size={18} />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {txn.type === 'debit' ? txn.receiver || txn.description || 'Debit' : txn.sender || txn.description || 'Credit'}
                    </p>
                    <p className="text-sm text-gray-500">{txn.category} • {new Date(txn.createdAt).toLocaleString()}</p>
                    {txn.description && <p className="text-xs text-gray-400 mt-0.5">{txn.description}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-semibold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.type === 'credit' ? '+' : '-'}₹{txn.amount?.toLocaleString('en-IN')}
                  </span>
                  <p className="text-xs mt-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      txn.status === 'success' ? 'bg-green-100 text-green-700' :
                      txn.status === 'blocked' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {txn.status}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-6 py-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <FiChevronLeft size={16} /> Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition cursor-pointer ${
                    page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            Next <FiChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
