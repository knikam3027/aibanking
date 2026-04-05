import { useState, useEffect } from 'react';
import { adminWithdrawToAccount, getAdminBankBalance } from '../services/api';
import { FiSend, FiCheckCircle, FiAlertCircle, FiDollarSign, FiInfo } from 'react-icons/fi';

const BANK_MAP = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank', PUNB: 'Punjab National Bank', BARB: 'Bank of Baroda',
  KKBK: 'Kotak Mahindra Bank', CNRB: 'Canara Bank', IOBA: 'Indian Overseas Bank',
  UBIN: 'Union Bank of India', BKID: 'Bank of India', IDIB: 'Indian Bank',
  CBIN: 'Central Bank of India', YESB: 'Yes Bank', INDB: 'IndusInd Bank',
  FDRL: 'Federal Bank', KARB: 'Karnataka Bank', SIBL: 'South Indian Bank',
};

export default function AdminWithdraw() {
  const [form, setForm] = useState({ accountNumber: '', ifsc: '', amount: '', beneficiaryName: '', description: '' });
  const [bankInfo, setBankInfo] = useState(null);
  const [bankBalance, setBankBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form'); // form | review | done

  useEffect(() => {
    loadBankBalance();
  }, []);

  const loadBankBalance = async () => {
    try {
      const { data } = await getAdminBankBalance();
      setBankBalance(data.balance);
    } catch { /* ignore */ }
  };

  const handleIfscChange = (value) => {
    const upper = value.toUpperCase();
    setForm({ ...form, ifsc: upper });
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper)) {
      const prefix = upper.substring(0, 4);
      const bank = BANK_MAP[prefix];
      setBankInfo(bank ? { bank, prefix, branch: upper.substring(5), valid: true } : { bank: `Unknown (${prefix})`, prefix, branch: upper.substring(5), valid: true });
    } else {
      setBankInfo(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.accountNumber || !form.ifsc || !form.amount || !form.beneficiaryName) {
      setError('All fields except description are required.');
      return;
    }
    if (!/^\d{9,18}$/.test(form.accountNumber)) {
      setError('Account number must be 9-18 digits.');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc)) {
      setError('Invalid IFSC code format.');
      return;
    }
    if (parseFloat(form.amount) <= 0) {
      setError('Amount must be positive.');
      return;
    }
    if (bankBalance !== null && parseFloat(form.amount) > bankBalance) {
      setError(`Insufficient bank balance. Available: ₹${bankBalance.toLocaleString('en-IN')}`);
      return;
    }
    setStep('review');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminWithdrawToAccount({
        accountNumber: form.accountNumber,
        ifsc: form.ifsc,
        amount: parseFloat(form.amount),
        beneficiaryName: form.beneficiaryName,
        description: form.description,
      });
      setResult(data);
      setStep('done');
      loadBankBalance();
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer failed.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ accountNumber: '', ifsc: '', amount: '', beneficiaryName: '', description: '' });
    setBankInfo(null);
    setResult(null);
    setError('');
    setStep('form');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Withdraw to Account</h1>
          <p className="text-gray-500 mt-1">Send money from bank reserve to any account via NEFT</p>
        </div>
        {bankBalance !== null && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg">
            <FiDollarSign size={18} />
            <span className="text-sm font-medium">Bank Reserve: ₹{bankBalance.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <FiAlertCircle size={20} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {step === 'form' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Transfer Details</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Name *</label>
                <input type="text" value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                <input type="text" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 1234567890" maxLength={18} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code *</label>
                <input type="text" value={form.ifsc} onChange={(e) => handleIfscChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. SBIN0001234" maxLength={11} />
                {bankInfo && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-sm text-emerald-600">
                    <FiCheckCircle size={14} />
                    <span>{bankInfo.bank} (Branch: {bankInfo.branch})</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 5000" min="1" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Salary payment for April" />
            </div>
            <button type="submit" className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition cursor-pointer font-medium">
              <FiSend size={16} /> Review Transfer
            </button>
          </form>
        </div>
      )}

      {step === 'review' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Review & Confirm</h2>
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Beneficiary:</span> <span className="font-semibold text-gray-900">{form.beneficiaryName}</span></div>
              <div><span className="text-gray-500">Amount:</span> <span className="font-semibold text-indigo-600 text-lg">₹{parseFloat(form.amount).toLocaleString('en-IN')}</span></div>
              <div><span className="text-gray-500">Account:</span> <span className="font-medium text-gray-900">{form.accountNumber}</span></div>
              <div><span className="text-gray-500">IFSC:</span> <span className="font-medium text-gray-900">{form.ifsc}</span></div>
              {bankInfo && <div className="col-span-2"><span className="text-gray-500">Bank:</span> <span className="font-medium text-gray-900">{bankInfo.bank}</span></div>}
              {form.description && <div className="col-span-2"><span className="text-gray-500">Note:</span> <span className="text-gray-700">{form.description}</span></div>}
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-sm">
            <FiInfo size={16} />
            <span>This will be processed as NEFT transfer from bank reserve.</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('form')} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer font-medium">Back</button>
            <button onClick={handleConfirm} disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer font-medium">
              {loading ? 'Processing...' : '✅ Confirm & Send'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheckCircle className="text-emerald-600" size={32} />
            </div>
            <h2 className="text-xl font-bold text-emerald-700">{result.message}</h2>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">UTR Number:</span> <span className="font-bold text-indigo-600">{result.utr}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Beneficiary:</span> <span className="font-medium">{result.beneficiaryName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account:</span> <span className="font-medium">{result.accountNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IFSC:</span> <span className="font-medium">{result.ifsc}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bank:</span> <span className="font-medium">{result.bankName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Amount:</span> <span className="font-bold text-lg">₹{result.amount.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Mode:</span> <span className="font-medium">NEFT</span></div>
            {result.internalUser && (
              <div className="flex justify-between"><span className="text-gray-500">System User:</span> <span className="font-medium text-emerald-600">✅ {result.recipientName} (credited internally)</span></div>
            )}
            <hr className="my-2" />
            <div className="flex justify-between"><span className="text-gray-500">Bank Reserve:</span> <span className="font-medium">₹{result.bankBalance.toLocaleString('en-IN')}</span></div>
          </div>
          <button onClick={resetForm} className="w-full bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition cursor-pointer font-medium">
            Make Another Transfer
          </button>
        </div>
      )}
    </div>
  );
}
