const Loan = require('../models/Loan');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const axios = require('axios');

exports.checkEligibility = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid loan amount.' });
    }

    const account = await Account.findOne({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);

    let result;
    try {
      const response = await axios.post(`${process.env.AI_SERVICE_URL}/loan-score`, {
        amount,
        balance: account ? account.balance : 0,
        transactions: transactions.map(t => ({
          amount: t.amount,
          type: t.type,
          category: t.category,
          status: t.status,
          createdAt: t.createdAt,
        })),
      }, { timeout: 5000 });
      result = response.data;
    } catch {
      // Fallback scoring
      const balance = account ? account.balance : 0;
      const score = Math.min(100, Math.max(0, Math.round((balance / (amount || 1)) * 50 + transactions.length * 2)));
      result = {
        score,
        status: score >= 60 ? 'approved' : score >= 40 ? 'review' : 'rejected',
        interest_rate: score >= 60 ? 8.5 : score >= 40 ? 12.0 : 15.0,
        reason: score >= 60 ? 'Good financial standing' : score >= 40 ? 'Needs manual review' : 'Insufficient financial history',
      };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

exports.apply = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid loan amount.' });
    }

    const account = await Account.findOne({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);

    let aiResult;
    try {
      const response = await axios.post(`${process.env.AI_SERVICE_URL}/loan-score`, {
        amount,
        balance: account ? account.balance : 0,
        transactions: transactions.map(t => ({
          amount: t.amount, type: t.type, category: t.category,
          status: t.status, createdAt: t.createdAt,
        })),
      }, { timeout: 5000 });
      aiResult = response.data;
    } catch {
      const balance = account ? account.balance : 0;
      const score = Math.min(100, Math.max(0, Math.round((balance / (amount || 1)) * 50 + transactions.length * 2)));
      aiResult = {
        score,
        status: score >= 60 ? 'approved' : score >= 40 ? 'review' : 'rejected',
        interest_rate: score >= 60 ? 8.5 : score >= 40 ? 12.0 : 15.0,
        reason: score >= 60 ? 'Good financial standing' : score >= 40 ? 'Needs manual review' : 'Insufficient financial history',
      };
    }

    const loan = await Loan.create({
      userId: req.userId,
      amount,
      status: aiResult.status,
      interestRate: aiResult.interest_rate,
      aiScore: aiResult.score,
      reason: aiResult.reason,
    });

    res.status(201).json(loan);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
