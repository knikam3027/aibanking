import { useState, useEffect, useRef } from 'react';
import { transferMoney, transferWithVoice, getPendingTransferStatus, simulateVoiceResponse, getVerificationStatus, simulateVerification } from '../services/api';
import { FiSend, FiCheckCircle, FiAlertTriangle, FiInfo, FiPhone, FiPhoneCall, FiShield, FiXCircle, FiLock } from 'react-icons/fi';

const BANK_MAP = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank', PUNB: 'Punjab National Bank', CNRB: 'Canara Bank',
  UBIN: 'Union Bank of India', BKID: 'Bank of India', BARB: 'Bank of Baroda',
  IOBA: 'Indian Overseas Bank', IDIB: 'IDBI Bank', KKBK: 'Kotak Mahindra Bank',
  YESB: 'Yes Bank', INDB: 'IndusInd Bank', MAHB: 'Bank of Maharashtra',
  CORP: 'Union Bank (Corp)', ALLA: 'Indian Bank (Allahabad)', CBIN: 'Central Bank',
  UCBA: 'UCO Bank', FDRL: 'Federal Bank', IDFB: 'IDFC First Bank',
};

function getIFSCInfo(ifsc) {
  if (!ifsc || ifsc.length !== 11) return null;
  const prefix = ifsc.substring(0, 4).toUpperCase();
  const bank = BANK_MAP[prefix];
  if (!bank) return null;
  return { bank, branch: ifsc.substring(5) };
}

const STATUS_MAP = {
  pending: { label: 'Initiating call...', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '📞' },
  calling: { label: 'Calling your phone — Answer to verify', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: '📱' },
  confirmed: { label: 'Call verified — Approve to complete transfer', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: '✅' },
  completed: { label: 'Transfer completed successfully!', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: '🎉' },
  declined: { label: 'Transfer declined via voice call', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: '❌' },
  expired: { label: 'Call not answered — Transfer cancelled', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: '⏰' },
  failed: { label: 'Transfer failed — Please try again', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: '⚠️' },
};

export default function Transfer() {
  const [form, setForm] = useState({
    receiverAccount: '', ifsc: '', beneficiaryName: '',
    amount: '', category: 'Transfer', description: '',
    phoneNumber: '+917020542266',
  });
  const [mode, setMode] = useState('normal'); // 'normal' or 'voice'
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Voice verification state
  const [voiceState, setVoiceState] = useState(null); // { pendingId, status, ... }
  const pollRef = useRef(null);

  // Post-transfer verification state (for > ₹1 lakh)
  const [postVerify, setPostVerify] = useState(null); // { verificationId, status, ... }
  const postVerifyPollRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === 'ifsc' ? value.toUpperCase() : value });
  };

  const ifscInfo = getIFSCInfo(form.ifsc);

  // Poll for voice verification status
  useEffect(() => {
    if (voiceState?.pendingId && ['pending', 'calling'].includes(voiceState.status)) {
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await getPendingTransferStatus(voiceState.pendingId);
          setVoiceState(prev => ({ ...prev, ...data, status: data.status }));
          if (!['pending', 'calling'].includes(data.status)) {
            clearInterval(pollRef.current);
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
      return () => clearInterval(pollRef.current);
    }
  }, [voiceState?.pendingId, voiceState?.status]);

  // Poll for post-transfer verification status (>₹1L)
  useEffect(() => {
    if (postVerify?.verificationId && ['pending', 'calling'].includes(postVerify.status)) {
      postVerifyPollRef.current = setInterval(async () => {
        try {
          const { data } = await getVerificationStatus(postVerify.verificationId);
          setPostVerify(prev => ({ ...prev, ...data }));
          if (!['pending', 'calling'].includes(data.status)) {
            clearInterval(postVerifyPollRef.current);
          }
        } catch { /* ignore */ }
      }, 3000);
      return () => clearInterval(postVerifyPollRef.current);
    }
  }, [postVerify?.verificationId, postVerify?.status]);

  const validate = () => {
    if (!form.receiverAccount || !form.amount || Number(form.amount) <= 0) {
      setError('Please fill in valid account number and amount.');
      return false;
    }
    if (form.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc)) {
      setError('Invalid IFSC code format (e.g., ICIC0000915).');
      return false;
    }
    if (mode === 'voice' && !form.phoneNumber) {
      setError('Phone number is required for voice verification.');
      return false;
    }
    return true;
  };

  // Normal transfer
  const handleNormalTransfer = async (e) => {
    e.preventDefault();
    setError(''); setResult(null); setVoiceState(null); setPostVerify(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        receiverAccount: form.receiverAccount,
        amount: Number(form.amount),
        category: form.category,
        description: [
          form.beneficiaryName && `To: ${form.beneficiaryName}`,
          form.ifsc && `IFSC: ${form.ifsc}`,
          ifscInfo && `Bank: ${ifscInfo.bank}`,
          form.description
        ].filter(Boolean).join(' | ')
      };
      const { data } = await transferMoney(payload);
      setResult({ ...data, beneficiaryName: form.beneficiaryName, ifsc: form.ifsc, bankName: ifscInfo?.bank });
      resetForm();

      // If verification required (>₹1L), set up post-transfer verification
      if (data.verificationId) {
        setPostVerify({
          verificationId: data.verificationId,
          status: 'pending',
          amount: Number(form.amount),
          beneficiaryName: form.beneficiaryName,
        });
      }
    } catch (err) {
      if (err.response?.data?.held) {
        setError(`🔒 ${err.response.data.message}`);
      } else if (err.response?.data?.fraud) {
        setError(`🚨 Transaction blocked: ${err.response.data.reason}`);
      } else {
        setError(err.response?.data?.message || 'Transfer failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Voice-verified transfer
  const handleVoiceTransfer = async (e) => {
    e.preventDefault();
    setError(''); setResult(null); setVoiceState(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        receiverAccount: form.receiverAccount,
        amount: Number(form.amount),
        category: form.category,
        description: form.description || '',
        beneficiaryName: form.beneficiaryName || '',
        ifsc: form.ifsc || '',
        phoneNumber: form.phoneNumber,
      };
      const { data } = await transferWithVoice(payload);
      setVoiceState({
        pendingId: data.pendingTransferId,
        status: data.status === 'calling' ? 'calling' : 'pending',
        riskLevel: data.riskLevel,
        riskReason: data.riskReason,
        callInitiated: data.callInitiated,
        phoneNumber: data.phoneNumber,
        amount: Number(form.amount),
        beneficiaryName: form.beneficiaryName,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate voice verification.');
    } finally {
      setLoading(false);
    }
  };

  // Simulate voice response (for local testing)
  const handleSimulate = async (digit) => {
    if (!voiceState?.pendingId) return;
    try {
      const { data } = await simulateVoiceResponse(voiceState.pendingId, digit);
      setVoiceState(prev => ({ ...prev, status: data.status, newBalance: data.newBalance }));
    } catch (err) {
      setError(err.response?.data?.message || 'Simulation failed.');
    }
  };

  // Simulate post-transfer verification response (AWS Connect test mode)
  const handlePostVerifySimulate = async (digit) => {
    if (!postVerify?.verificationId) return;
    try {
      const { data } = await simulateVerification(postVerify.verificationId, digit);
      setPostVerify(prev => ({ ...prev, ...data }));
    } catch (err) {
      setError(err.response?.data?.message || 'Simulation failed.');
    }
  };

  const resetForm = () => {
    setForm({ receiverAccount: '', ifsc: '', beneficiaryName: '', amount: '', category: 'Transfer', description: '', phoneNumber: form.phoneNumber });
  };

  const resetAll = () => {
    resetForm();
    setVoiceState(null);
    setPostVerify(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Transfer Money</h2>

      {/* Mode Toggle */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => { setMode('normal'); setVoiceState(null); setError(''); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
            mode === 'normal' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <FiSend size={14} /> Quick Transfer
        </button>
        <button
          onClick={() => { setMode('voice'); setResult(null); setError(''); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer ${
            mode === 'voice' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <FiPhoneCall size={14} /> Voice Verified Transfer
        </button>
      </div>

      {/* Voice mode info banner */}
      {mode === 'voice' && !voiceState && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <FiShield className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="font-semibold text-green-800 text-sm">AI Voice Verification</p>
              <p className="text-xs text-green-700 mt-1">
                For enhanced security, we'll call your phone to confirm the transfer.
                You'll hear the transfer details and can press <strong>1 to confirm</strong> or <strong>2 to decline</strong>.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-green-600">
                <span className="bg-green-100 px-2 py-0.5 rounded-full">🔒 Fraud Prevention</span>
                <span className="bg-green-100 px-2 py-0.5 rounded-full">📞 Voice Confirmation</span>
                <span className="bg-green-100 px-2 py-0.5 rounded-full">🛡️ High-Value Security</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success result (normal transfer) */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-2">
          <div className="flex items-start gap-3">
            <FiCheckCircle className="text-green-600 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-green-800">Transfer Successful!</p>
              <p className="text-sm text-green-700 mt-1">
                ₹{result.transaction?.amount?.toLocaleString('en-IN')} sent
                {result.beneficiaryName && ` to ${result.beneficiaryName}`}
              </p>
              {result.bankName && (
                <p className="text-sm text-green-600">🏦 {result.bankName}{result.ifsc && ` (${result.ifsc})`}</p>
              )}
              <p className="text-sm text-green-700 mt-1">
                New Balance: <strong>₹{result.newBalance?.toLocaleString('en-IN')}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Post-Transfer Verification (> ₹1 Lakh) — AWS Connect */}
      {postVerify && (
        <div className={`rounded-xl border-2 p-5 space-y-4 ${
          postVerify.status === 'confirmed' ? 'bg-green-50 border-green-300' :
          postVerify.status === 'suspicious' ? 'bg-red-50 border-red-300' :
          'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-start gap-3">
            {postVerify.status === 'suspicious' ? (
              <FiLock className="text-red-600 mt-0.5" size={22} />
            ) : postVerify.status === 'confirmed' ? (
              <FiCheckCircle className="text-green-600 mt-0.5" size={22} />
            ) : (
              <FiPhone className="text-amber-600 mt-0.5 animate-bounce" size={22} />
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {postVerify.status === 'confirmed' && '✅ Transfer Verified — Confirmed by you'}
                {postVerify.status === 'suspicious' && '🚨 Account Held — Transaction reported suspicious'}
                {postVerify.status === 'no_response' && '⏰ No response — Account held for review'}
                {['pending', 'calling'].includes(postVerify.status) && '📞 Verification Call — Answer to confirm'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                High-value transfer (&gt; ₹1,00,000) requires voice confirmation via AWS Connect.
              </p>
              {postVerify.status === 'suspicious' && (
                <p className="text-xs text-red-700 mt-2 font-medium">
                  Your account has been temporarily frozen. Admin will review and unhold your account.
                </p>
              )}
            </div>
          </div>

          {/* Calling animation */}
          {['pending', 'calling'].includes(postVerify.status) && (
            <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
              <div className="relative">
                <FiPhone className="text-amber-600 animate-bounce" size={20} />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {postVerify.status === 'pending' ? 'Connecting AWS Connect...' : 'Calling your phone — Answer to verify'}
                </p>
                <p className="text-xs text-gray-500">Press 1 to confirm | Press 2 to report suspicious</p>
              </div>
            </div>
          )}

          {/* Test simulation controls */}
          {['pending', 'calling'].includes(postVerify.status) && (
            <div className="border-t border-dashed border-amber-300 pt-3">
              <p className="text-xs text-gray-500 mb-2 font-medium">🧪 Test Mode — Simulate verification response:</p>
              <div className="flex gap-2">
                <button onClick={() => handlePostVerifySimulate(1)}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <FiCheckCircle size={14} /> Press 1 — Confirm
                </button>
                <button onClick={() => handlePostVerifySimulate(2)}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <FiXCircle size={14} /> Press 2 — Suspicious
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice Verification Status */}
      {voiceState && (
        <div className={`${STATUS_MAP[voiceState.status]?.bg || 'bg-gray-50'} border ${STATUS_MAP[voiceState.status]?.border || 'border-gray-200'} rounded-xl p-5`}>
          <div className="space-y-4">
            {/* Status header */}
            <div className="flex items-center gap-3">
              <span className="text-2xl">{STATUS_MAP[voiceState.status]?.icon || '📞'}</span>
              <div>
                <p className={`font-semibold ${STATUS_MAP[voiceState.status]?.color || 'text-gray-700'}`}>
                  {STATUS_MAP[voiceState.status]?.label || voiceState.status}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  ₹{voiceState.amount?.toLocaleString('en-IN')}
                  {voiceState.beneficiaryName && ` → ${voiceState.beneficiaryName}`}
                </p>
              </div>
            </div>

            {/* Risk badge */}
            {voiceState.riskLevel && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  voiceState.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                  voiceState.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  Risk: {voiceState.riskLevel.toUpperCase()}
                </span>
                <span className="text-gray-500">{voiceState.riskReason}</span>
              </div>
            )}

            {/* Calling animation */}
            {['pending', 'calling'].includes(voiceState.status) && (
              <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                <div className="relative">
                  <FiPhone className="text-green-600 animate-bounce" size={24} />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {voiceState.status === 'pending' ? 'Connecting to Exotel...' : 'Ringing your phone...'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {voiceState.phoneNumber || 'Phone number on file'}
                  </p>
                </div>
              </div>
            )}

            {/* Confirmed — user answered call, now approve in app */}
            {voiceState.status === 'confirmed' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-green-100/60 rounded-lg p-3">
                  <FiCheckCircle className="text-green-600" size={24} />
                  <div>
                    <p className="text-sm font-medium text-green-800">Identity verified via phone call</p>
                    <p className="text-xs text-green-600">Approve below to complete the transfer</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSimulate(1)}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FiCheckCircle size={16} /> Approve Transfer — ₹{voiceState.amount?.toLocaleString('en-IN')}
                  </button>
                  <button
                    onClick={() => handleSimulate(2)}
                    className="bg-red-100 text-red-700 px-4 py-3 rounded-lg text-sm font-medium hover:bg-red-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FiXCircle size={14} /> Decline
                  </button>
                </div>
              </div>
            )}

            {/* Completed — show balance */}
            {voiceState.status === 'completed' && voiceState.newBalance != null && (
              <p className="text-sm text-green-700">
                New Balance: <strong>₹{voiceState.newBalance.toLocaleString('en-IN')}</strong>
              </p>
            )}

            {/* Simulation controls (for local testing) */}
            {['pending', 'calling'].includes(voiceState.status) && (
              <div className="border-t border-dashed pt-3 mt-3">
                <p className="text-xs text-gray-500 mb-2 font-medium">🧪 Test Mode — Simulate voice response:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSimulate(1)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FiCheckCircle size={14} /> Press 1 — Confirm
                  </button>
                  <button
                    onClick={() => handleSimulate(2)}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FiXCircle size={14} /> Press 2 — Decline
                  </button>
                </div>
              </div>
            )}

            {/* Reset button for terminal states */}
            {['completed', 'declined', 'expired', 'failed'].includes(voiceState.status) && (
              <button
                onClick={resetAll}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition cursor-pointer"
              >
                New Transfer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <FiAlertTriangle className="text-red-600 mt-0.5" size={20} />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Transfer Form — hide when voice verification is active */}
      {!voiceState && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={mode === 'voice' ? handleVoiceTransfer : handleNormalTransfer} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Name</label>
              <input
                type="text"
                name="beneficiaryName"
                value={form.beneficiaryName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="e.g., Krishna Nikam"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                name="receiverAccount"
                value={form.receiverAccount}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="Enter account number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                name="ifsc"
                value={form.ifsc}
                onChange={handleChange}
                maxLength={11}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="e.g., ICIC0000915"
              />
              {ifscInfo && (
                <div className="mt-2 flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
                  <FiInfo size={14} />
                  <span><strong>{ifscInfo.bank}</strong> — Branch: {ifscInfo.branch}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="0"
              />
            </div>

            {/* Phone number — only in voice mode */}
            {mode === 'voice' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiPhone className="inline mr-1" size={14} /> Your Phone Number
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={form.phoneNumber}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                  placeholder="+91XXXXXXXXXX"
                />
                <p className="text-xs text-gray-400 mt-1">We'll call this number to verify the transfer</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              >
                <option>Transfer</option>
                <option>Food</option>
                <option>Shopping</option>
                <option>Bills</option>
                <option>Entertainment</option>
                <option>Rent</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="e.g., Rent payment"
              />
            </div>

            {mode === 'normal' ? (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <FiSend size={16} />
                {loading ? 'Processing...' : 'Send Money'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <FiPhoneCall size={16} />
                {loading ? 'Initiating Call...' : 'Transfer & Verify by AI Voice Call'}
              </button>
            )}
          </form>
        </div>
      )}

      {/* How it works — voice mode */}
      {mode === 'voice' && !voiceState && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">How Voice Verification Works</p>
          <div className="space-y-2.5">
            {[
              { step: '1', text: 'Fill the transfer details and click "Transfer & Verify"' },
              { step: '2', text: 'Our AI runs a risk assessment on the transaction' },
              { step: '3', text: 'You receive a voice call on your registered number' },
              { step: '4', text: 'Press 1 to confirm or Press 2 to decline' },
              { step: '5', text: 'Transfer is processed only after voice confirmation' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step}</span>
                <p className="text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
