import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);

// User
export const getProfile = () => API.get('/user/profile');

// Account
export const getAccountDetails = () => API.get('/account/details');

// Transactions
export const getTransactions = () => API.get('/transactions');
export const transferMoney = (data) => API.post('/transactions/transfer', data);
export const transferWithVoice = (data) => API.post('/transactions/transfer-voice', data);
export const getPendingTransferStatus = (id) => API.get(`/transactions/pending/${id}`);
export const simulateVoiceResponse = (id, digit) => API.post(`/exotel/simulate/${id}`, { digit });

// Loans
export const checkLoanEligibility = (data) => API.post('/loans/check-eligibility', data);
export const applyLoan = (data) => API.post('/loans/apply', data);

// AI
export const aiChat = (data) => API.post('/ai/chat', data);
export const getInsights = () => API.get('/ai/insights');
export const predictBalance = () => API.get('/ai/predict-balance');
export const getCashFlow = () => API.get('/ai/cashflow');
export const getChatHistory = () => API.get('/ai/chat-history');
export const aiTransfer = (data) => API.post('/ai/transfer', data);

// Alerts
export const getAlerts = () => API.get('/alerts');
export const markAlertRead = (id) => API.patch(`/alerts/${id}/read`);
export const generateSmartAlerts = () => API.post('/alerts/generate-smart');

// Admin
export const getAdminDashboard = () => API.get('/admin/dashboard');
export const getAdminUsers = () => API.get('/admin/users');
export const getAdminBankBalance = () => API.get('/admin/bank-balance');
export const adminAddBalance = (data) => API.post('/admin/add-balance', data);
export const adminAddBalanceBulk = (data) => API.post('/admin/add-balance-bulk', data);
export const adminWithdrawToAccount = (data) => API.post('/admin/withdraw-to-account', data);

// Admin Payroll
export const uploadSalaryPdf = (formData) => API.post('/admin/payroll/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const verifyPayrollAccounts = (batchId) => API.post(`/admin/payroll/${batchId}/verify`);
export const reviewPayrollBatch = (batchId) => API.get(`/admin/payroll/${batchId}/review`);
export const confirmPayroll = (batchId) => API.post(`/admin/payroll/${batchId}/pay`);
export const getPayrollBatches = () => API.get('/admin/payroll/batches');
export const getPayrollBatchDetails = (batchId) => API.get(`/admin/payroll/${batchId}`);

export default API;
