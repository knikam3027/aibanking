import { useState, useEffect, useRef } from 'react';
import {
  uploadSalaryPdf, verifyPayrollAccounts, reviewPayrollBatch,
  confirmPayroll, getPayrollBatches, getPayrollBatchDetails,
} from '../services/api';
import {
  FiUpload, FiCheckCircle, FiXCircle, FiDollarSign, FiFileText,
  FiRefreshCw, FiAlertTriangle, FiClock, FiArrowLeft, FiShield,
} from 'react-icons/fi';

const STEPS = ['Upload PDF', 'Verify Accounts', 'Review & Pay', 'Completed'];

export default function AdminPayroll() {
  const [step, setStep] = useState(0);
  const [batch, setBatch] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const { data } = await getPayrollBatches();
      setBatches(data);
    } catch {}
  };

  // Step 1: Upload PDF
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await uploadSalaryPdf(formData);
      setBatch(data.batch);
      setEmployees(data.batch.employees);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload PDF.');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Step 2: Verify accounts (₹1 token)
  const handleVerify = async () => {
    if (!batch) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await verifyPayrollAccounts(batch._id);
      setEmployees(data.employees);
      if (data.verifiedCount > 0) {
        setStep(2);
        // Load review data
        const review = await reviewPayrollBatch(batch._id);
        setSummary(review.data.summary);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Confirm and pay
  const handleConfirmPay = async () => {
    if (!batch) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await confirmPayroll(batch._id);
      setResults(data);
      setStep(3);
      loadBatches();
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  // Load a past batch
  const loadBatch = async (batchId) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await getPayrollBatchDetails(batchId);
      setBatch(data.batch);
      setEmployees(data.employees);
      setShowHistory(false);

      if (data.batch.status === 'completed' || data.batch.status === 'failed') {
        setResults({ paidCount: data.batch.paidCount, failedCount: data.batch.failedCount, results: data.employees.filter(e => e.status === 'paid').map(e => ({ name: e.name, status: 'paid', utr: e.utr, amount: e.salary })) });
        setStep(3);
      } else if (data.batch.status === 'verified') {
        const review = await reviewPayrollBatch(batchId);
        setSummary(review.data.summary);
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load batch.');
    } finally {
      setLoading(false);
    }
  };

  // Reset to start over
  const handleReset = () => {
    setStep(0);
    setBatch(null);
    setEmployees([]);
    setSummary(null);
    setResults(null);
    setError('');
  };

  const statusBadge = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-700',
      verified: 'bg-green-100 text-green-700',
      verification_failed: 'bg-red-100 text-red-700',
      paid: 'bg-emerald-100 text-emerald-700',
      payment_failed: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Salary Payroll</h2>
          <p className="text-sm text-gray-500 mt-1">Upload salary PDF → AI analyzes → Verify accounts → Pay via NEFT</p>
        </div>
        <div className="flex gap-2">
          {step > 0 && step < 3 && (
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition cursor-pointer">
              <FiArrowLeft size={14} /> Start Over
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition cursor-pointer"
          >
            <FiClock size={14} /> {showHistory ? 'Hide' : 'Show'} History
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm font-medium ${i <= step ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <FiAlertTriangle className="text-red-600 shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer">✕</button>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Payroll History</h3>
          </div>
          {batches.length === 0 ? (
            <p className="p-6 text-gray-500 text-center text-sm">No payroll batches yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {batches.map((b) => (
                <div key={b._id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => loadBatch(b._id)}>
                  <div className="flex items-center gap-3">
                    <FiFileText className="text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.fileName}</p>
                      <p className="text-xs text-gray-500">{b.employeeCount} employees • ₹{b.totalAmount?.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(b.status)}
                    <span className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 0: Upload PDF */}
      {step === 0 && !showHistory && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiUpload className="text-indigo-600" size={28} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Upload Salary Sheet PDF</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              Upload a PDF with employee details: Name, Account Number, IFSC Code, and Salary Amount.
              AI will automatically extract and analyze the data.
            </p>
            <label className={`inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {loading ? <FiRefreshCw className="animate-spin" size={18} /> : <FiUpload size={18} />}
              {loading ? 'AI Analyzing PDF...' : 'Choose PDF File'}
              <input type="file" accept=".pdf" onChange={handleUpload} ref={fileRef} className="hidden" disabled={loading} />
            </label>
            <p className="text-xs text-gray-400 mt-3">Max file size: 10MB • PDF format only</p>
          </div>
        </div>
      )}

      {/* STEP 1: Verify Accounts */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">📄 Parsed Employees — {batch?.fileName}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  AI found {employees.length} employees • Total: ₹{batch?.totalAmount?.toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? <FiRefreshCw className="animate-spin" size={16} /> : <FiShield size={16} />}
                {loading ? 'Verifying...' : `Verify All (₹${employees.length} — ₹1 each)`}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Employee Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Account Number</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">IFSC Code</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Salary</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp, i) => (
                    <tr key={i} className={emp.status === 'verification_failed' ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.accountNumber}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.ifsc || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{emp.salary?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(emp.status)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="4" className="px-4 py-3 font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">₹{batch?.totalAmount?.toLocaleString('en-IN')}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {employees.some(e => e.verificationNote) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-medium text-amber-800 mb-2">Verification Notes:</p>
              {employees.filter(e => e.verificationNote).map((emp, i) => (
                <p key={i} className="text-sm text-amber-700">
                  {emp.verified ? '✅' : '❌'} {emp.name}: {emp.verificationNote}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Review & Confirm */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <h3 className="text-lg font-bold mb-3">📊 Payment Review Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-indigo-200 text-xs">Total Employees</p>
                <p className="text-2xl font-bold">{summary?.total || employees.length}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-xs">Verified ✅</p>
                <p className="text-2xl font-bold">{summary?.verified || 0}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-xs">Failed ❌</p>
                <p className="text-2xl font-bold">{summary?.failed || 0}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-xs">Total to Pay</p>
                <p className="text-2xl font-bold">₹{(summary?.totalToPay || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
            {summary && !summary.sufficient && (
              <div className="mt-4 bg-red-500/20 rounded-lg p-3">
                <p className="text-sm">⚠️ Insufficient balance! Need ₹{summary.totalToPay?.toLocaleString('en-IN')}, available: ₹{summary.bankBalance?.toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>

          {/* Verified Employee Table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Employees to Pay (Verified Only)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Account</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">IFSC</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Salary</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp, i) => (
                    <tr key={i} className={emp.verified ? '' : 'opacity-40'}>
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.accountNumber}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.ifsc || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{emp.verified ? `₹${emp.salary?.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {emp.verified ? <FiCheckCircle className="text-green-500 inline" /> : <FiXCircle className="text-red-400 inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Ready to process NEFT payments?</p>
                <p className="text-sm text-gray-500">This action will debit ₹{(summary?.totalToPay || 0).toLocaleString('en-IN')} from bank reserve and pay {summary?.verified || 0} employees.</p>
              </div>
              <button
                onClick={handleConfirmPay}
                disabled={loading || (summary && !summary.sufficient)}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? <FiRefreshCw className="animate-spin" size={18} /> : <FiDollarSign size={18} />}
                {loading ? 'Processing Payments...' : 'Confirm & Pay All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Results */}
      {step === 3 && results && (
        <div className="space-y-4">
          {/* Success Banner */}
          <div className={`rounded-xl p-6 ${results.failedCount === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              {results.failedCount === 0 ? (
                <FiCheckCircle className="text-green-600" size={28} />
              ) : (
                <FiAlertTriangle className="text-amber-600" size={28} />
              )}
              <h3 className={`text-lg font-bold ${results.failedCount === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                {results.failedCount === 0
                  ? '✅ All Salaries Paid Successfully!'
                  : `⚠️ Payment Complete — ${results.paidCount} Paid, ${results.failedCount} Failed`}
              </h3>
            </div>
            {results.totalPaid > 0 && (
              <p className="text-sm text-gray-600">Total disbursed: ₹{results.totalPaid?.toLocaleString('en-IN')} • Bank balance: ₹{results.bankBalance?.toLocaleString('en-IN')}</p>
            )}
          </div>

          {/* Payment Results with UTR */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Payment Details & UTR Numbers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Employee</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">UTR Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(results.results || []).map((r, i) => (
                    <tr key={i} className={r.status === 'paid' ? '' : 'bg-red-50'}>
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {r.amount ? `₹${r.amount.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.status === 'paid' ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Paid ✅</span>
                        ) : r.status === 'skipped' ? (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Skipped</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Failed ❌</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-600">{r.utr || r.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Start New Batch */}
          <div className="text-center">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition cursor-pointer"
            >
              <FiUpload size={18} /> Process New Salary Batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
