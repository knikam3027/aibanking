import { useState } from 'react';
import { checkLoanEligibility, applyLoan } from '../services/api';
import { FiDollarSign, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';

export default function Loans() {
  const [amount, setAmount] = useState('');
  const [eligibility, setEligibility] = useState(null);
  const [loanResult, setLoanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applyingLoan, setApplyingLoan] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    setError('');
    setEligibility(null);
    setLoanResult(null);

    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid loan amount.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await checkLoanEligibility({ amount: Number(amount) });
      setEligibility(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check eligibility.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplyingLoan(true);
    try {
      const { data } = await applyLoan({ amount: Number(amount) });
      setLoanResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply for loan.');
    } finally {
      setApplyingLoan(false);
    }
  };

  const statusIcon = (status) => {
    if (status === 'approved') return <FiCheckCircle className="text-green-600" size={24} />;
    if (status === 'rejected') return <FiXCircle className="text-red-600" size={24} />;
    return <FiClock className="text-yellow-600" size={24} />;
  };

  const statusColor = (status) => {
    if (status === 'approved') return 'bg-green-50 border-green-200';
    if (status === 'rejected') return 'bg-red-50 border-red-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Loan Eligibility</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleCheck} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="1000"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="e.g., 50000"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FiDollarSign size={16} />
            {loading ? 'Checking...' : 'Check Eligibility'}
          </button>
        </form>
      </div>

      {eligibility && !loanResult && (
        <div className={`rounded-xl border p-6 ${statusColor(eligibility.status)}`}>
          <div className="flex items-center gap-3 mb-4">
            {statusIcon(eligibility.status)}
            <div>
              <p className="font-semibold text-gray-900 capitalize">{eligibility.status}</p>
              <p className="text-sm text-gray-600">{eligibility.reason}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-gray-500">AI Score</p>
              <p className="text-xl font-bold text-gray-900">{eligibility.score}/100</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-gray-500">Interest Rate</p>
              <p className="text-xl font-bold text-gray-900">{eligibility.interest_rate}%</p>
            </div>
          </div>
          {eligibility.status !== 'rejected' && (
            <button
              onClick={handleApply}
              disabled={applyingLoan}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 cursor-pointer"
            >
              {applyingLoan ? 'Applying...' : 'Apply for Loan'}
            </button>
          )}
        </div>
      )}

      {loanResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <FiCheckCircle className="text-green-600" size={24} />
            <p className="font-semibold text-green-800">Loan Application Submitted!</p>
          </div>
          <p className="text-sm text-green-700">
            Amount: ₹{loanResult.amount?.toLocaleString('en-IN')} • Status: {loanResult.status} • Rate: {loanResult.interestRate}%
          </p>
        </div>
      )}
    </div>
  );
}
