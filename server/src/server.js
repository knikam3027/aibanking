require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const accountRoutes = require('./routes/account');
const transactionRoutes = require('./routes/transaction');
const loanRoutes = require('./routes/loan');
const aiRoutes = require('./routes/ai');
const alertRoutes = require('./routes/alert');
const adminRoutes = require('./routes/admin');
const payrollRoutes = require('./routes/payroll');
const exotelRoutes = require('./routes/exotel');
const connectRoutes = require('./routes/connect');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Exotel form-encoded callbacks

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/payroll', payrollRoutes);
app.use('/api/exotel', exotelRoutes); // Public Exotel callback routes (no auth)
app.use('/api/connect', connectRoutes); // AWS Connect verification routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
