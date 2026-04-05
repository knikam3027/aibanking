const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AiInsight = require('../models/AiInsight');
const ChatHistory = require('../models/ChatHistory');
const User = require('../models/User');
const axios = require('axios');

exports.chat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required.' });

    const account = await Account.findOne({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(30);

    // Get recent chat history for context memory
    const chatHistory = await ChatHistory.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(10);

    // Save user message
    await ChatHistory.create({ userId: req.userId, role: 'user', message });

    let reply;
    try {
      const response = await axios.post(`${process.env.AI_SERVICE_URL}/chat`, {
        message,
        balance: account ? account.balance : 0,
        transactions: transactions.map(t => ({
          amount: t.amount, type: t.type, category: t.category,
          receiver: t.receiver, sender: t.sender, createdAt: t.createdAt,
        })),
        chatHistory: chatHistory.reverse().map(h => ({
          role: h.role, message: h.message,
        })),
      }, { timeout: 10000 });
      reply = response.data.reply;
    } catch {
      // Fallback simple responses
      reply = getFallbackReply(message, account, transactions);
    }

    // Save AI reply
    await ChatHistory.create({ userId: req.userId, role: 'ai', message: reply });

    // Trim old chat history (keep last 50)
    const totalChats = await ChatHistory.countDocuments({ userId: req.userId });
    if (totalChats > 50) {
      const oldest = await ChatHistory.find({ userId: req.userId })
        .sort({ createdAt: 1 }).limit(totalChats - 50);
      await ChatHistory.deleteMany({ _id: { $in: oldest.map(c => c._id) } });
    }

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Get chat history
exports.getChatHistory = async (req, res) => {
  try {
    const history = await ChatHistory.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(30);
    res.json(history.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Cash flow predictions  
exports.getCashFlow = async (req, res) => {
  try {
    const account = await Account.findOne({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(60);

    const balance = account ? account.balance : 0;
    const debits = transactions.filter(t => t.type === 'debit');
    const credits = transactions.filter(t => t.type === 'credit');
    const totalSpent = debits.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = credits.reduce((sum, t) => sum + t.amount, 0);
    const avgDaily = debits.length > 0 ? totalSpent / debits.length : 0;

    // Generate 30-day projection
    const projection = [];
    let projected = balance;
    for (let i = 1; i <= 30; i++) {
      projected -= avgDaily;
      // Simulate salary on day ~28
      if (i === 28 && totalIncome > 0) {
        projected += totalIncome;
      }
      projection.push({
        day: i,
        label: `Day ${i}`,
        balance: Math.max(0, Math.round(projected)),
      });
    }

    // Spending by category
    const categories = {};
    debits.forEach(t => {
      const cat = t.category || 'General';
      categories[cat] = (categories[cat] || 0) + t.amount;
    });

    // Financial health score
    const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100) : 0;
    const healthScore = Math.min(100, Math.max(0, 50 + savingsRate));

    res.json({
      currentBalance: balance,
      totalIncome,
      totalSpent,
      avgDailySpend: Math.round(avgDaily),
      monthlySurplus: Math.round(totalIncome - totalSpent),
      savingsRate,
      healthScore,
      projection,
      spendingByCategory: categories,
      daysUntilLow: avgDaily > 0 ? Math.floor(balance / avgDaily) : 999,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

exports.getInsights = async (req, res) => {
  try {
    const account = await Account.findOne({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50);

    let insights;
    try {
      const response = await axios.post(`${process.env.AI_SERVICE_URL}/insights`, {
        balance: account ? account.balance : 0,
        transactions: transactions.map(t => ({
          amount: t.amount, type: t.type, category: t.category,
          createdAt: t.createdAt,
        })),
      }, { timeout: 5000 });
      insights = response.data;
    } catch {
      insights = generateFallbackInsights(account, transactions);
    }

    // Save insights to DB
    await AiInsight.findOneAndUpdate(
      { userId: req.userId },
      { ...insights, userId: req.userId },
      { upsert: true, new: true }
    );

    res.json(insights);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

exports.predictBalance = async (req, res) => {
  try {
    const account = await Account.findOne({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(30);

    let prediction;
    try {
      const response = await axios.post(`${process.env.AI_SERVICE_URL}/predict-expense`, {
        balance: account ? account.balance : 0,
        transactions: transactions.map(t => ({
          amount: t.amount, type: t.type, category: t.category,
          createdAt: t.createdAt,
        })),
      }, { timeout: 5000 });
      prediction = response.data;
    } catch {
      prediction = generateFallbackPrediction(account, transactions);
    }

    res.json(prediction);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

function getFallbackReply(message, account, transactions) {
  const msg = message.toLowerCase();
  const balance = account ? account.balance : 0;

  if (msg.includes('balance')) {
    return `Your current balance is ₹${balance.toLocaleString('en-IN')}.`;
  }
  if (msg.includes('spend') || msg.includes('spent')) {
    const totalSpent = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    return `You have spent ₹${totalSpent.toLocaleString('en-IN')} in your recent transactions.`;
  }
  if (msg.includes('saving') || msg.includes('save')) {
    return `Based on your spending, try to save at least 20% of your income. Your current balance is ₹${balance.toLocaleString('en-IN')}.`;
  }
  if (msg.includes('transaction') || msg.includes('recent')) {
    const recent = transactions.slice(0, 5);
    if (recent.length === 0) return 'You have no recent transactions.';
    const list = recent.map(t => `${t.type === 'debit' ? '↓' : '↑'} ₹${t.amount} - ${t.category}`).join('\n');
    return `Your recent transactions:\n${list}`;
  }
  return `I'm your AI banking assistant. I can help you with balance inquiries, spending analysis, saving tips, and more. Try asking about your balance, spending, or savings!`;
}

function generateFallbackInsights(account, transactions) {
  const balance = account ? account.balance : 0;
  const debits = transactions.filter(t => t.type === 'debit');
  const credits = transactions.filter(t => t.type === 'credit');
  const totalSpent = debits.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = credits.reduce((sum, t) => sum + t.amount, 0);

  const categories = {};
  debits.forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + t.amount;
  });

  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100) : 0;
  const healthScore = Math.min(100, Math.max(0, 50 + savingsRate));

  return {
    financialHealthScore: healthScore,
    monthlySummary: `You spent ₹${totalSpent.toLocaleString('en-IN')} across ${debits.length} transactions. Income: ₹${totalIncome.toLocaleString('en-IN')}.`,
    prediction: balance < totalSpent * 0.5 ? 'Your balance may become low soon. Consider reducing expenses.' : 'Your finances look stable for the coming weeks.',
    spendingBreakdown: categories,
    savingsRate,
    totalSpent,
    totalIncome,
  };
}

function generateFallbackPrediction(account, transactions) {
  const balance = account ? account.balance : 0;
  const debits = transactions.filter(t => t.type === 'debit');
  const avgSpending = debits.length > 0 ? debits.reduce((sum, t) => sum + t.amount, 0) / debits.length : 0;
  const predictedWeeklyExpense = avgSpending * 7;
  const daysUntilLow = avgSpending > 0 ? Math.floor(balance / avgSpending) : 999;

  return {
    predicted_weekly_expense: Math.round(predictedWeeklyExpense),
    days_until_low_balance: daysUntilLow,
    warning: daysUntilLow < 14 ? `Warning: You may run low on balance in ${daysUntilLow} days.` : 'Your balance looks healthy for the next few weeks.',
    avg_daily_spending: Math.round(avgSpending),
    current_balance: balance,
  };
}

// ============ AI CHAT TRANSFER ============

// IFSC bank info lookup
const BANK_MAP = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank', PUNB: 'Punjab National Bank', BARB: 'Bank of Baroda',
  KKBK: 'Kotak Mahindra Bank', CNRB: 'Canara Bank', IOBA: 'Indian Overseas Bank',
  UBIN: 'Union Bank of India', BKID: 'Bank of India', IDIB: 'Indian Bank',
  CBIN: 'Central Bank of India', YESB: 'Yes Bank', INDB: 'IndusInd Bank',
  FDRL: 'Federal Bank', KARB: 'Karnataka Bank', SIBL: 'South Indian Bank',
  RATN: 'RBL Bank', MAHB: 'Bank of Maharashtra', IDFB: 'IDFC First Bank',
};

exports.aiTransfer = async (req, res) => {
  try {
    const { accountNumber, ifsc, amount, beneficiaryName } = req.body;

    // Validate all required fields
    if (!accountNumber || !ifsc || !amount || !beneficiaryName) {
      return res.status(400).json({ message: 'All fields are required: accountNumber, ifsc, amount, beneficiaryName' });
    }

    // Validate account number (9-18 digits)
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({ message: 'Invalid account number. Must be 9-18 digits.' });
    }

    // Validate IFSC format
    const ifscUpper = ifsc.toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscUpper)) {
      return res.status(400).json({ message: 'Invalid IFSC code format. Must be like SBIN0001234.' });
    }

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number.' });
    }
    if (transferAmount > 10000000) {
      return res.status(400).json({ message: 'Maximum transfer limit is ₹1,00,00,000.' });
    }

    // Get sender account
    const senderAccount = await Account.findOne({ userId: req.userId });
    if (!senderAccount) {
      return res.status(404).json({ message: 'Your account not found.' });
    }

    if (senderAccount.balance < transferAmount) {
      return res.status(400).json({ message: `Insufficient balance. Available: ₹${senderAccount.balance.toLocaleString('en-IN')}` });
    }

    // Look up bank info from IFSC
    const bankPrefix = ifscUpper.substring(0, 4);
    const bankName = BANK_MAP[bankPrefix] || `Bank (${bankPrefix})`;
    const branchCode = ifscUpper.substring(5);

    // Generate UTR number
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const utr = `${bankPrefix}N${timestamp}${random}`;

    // Deduct from sender
    senderAccount.balance -= transferAmount;
    await senderAccount.save();

    // Check if receiver exists in our system (optional — external transfers still work)
    const receiverAccount = await Account.findOne({ accountNumber });
    if (receiverAccount) {
      receiverAccount.balance += transferAmount;
      await receiverAccount.save();

      // Record receiver credit
      const receiverUser = await User.findById(receiverAccount.userId);
      const senderUser = await User.findById(req.userId);
      await Transaction.create({
        userId: receiverAccount.userId,
        type: 'credit',
        amount: transferAmount,
        category: 'Transfer',
        sender: senderUser ? senderUser.name : 'AI Transfer',
        description: `NEFT from ${senderUser ? senderUser.name : 'User'} via AI Chat`,
        status: 'success',
      });
    }

    // Record sender debit
    const senderUser = await User.findById(req.userId);
    await Transaction.create({
      userId: req.userId,
      type: 'debit',
      amount: transferAmount,
      category: 'Transfer',
      receiver: beneficiaryName,
      description: `NEFT to ${beneficiaryName} (${bankName}) via AI Chat | UTR: ${utr}`,
      status: 'success',
    });

    res.json({
      success: true,
      message: 'Transfer successful!',
      utr,
      bankName,
      branchCode,
      beneficiaryName,
      accountNumber,
      ifsc: ifscUpper,
      amount: transferAmount,
      newBalance: senderAccount.balance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Transfer failed.', error: error.message });
  }
};

// Admin: Withdraw/send money to any user account
exports.adminWithdrawToUser = async (req, res) => {
  try {
    const { accountNumber, ifsc, amount, beneficiaryName, description } = req.body;

    if (!accountNumber || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Account number and valid amount are required.' });
    }

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number.' });
    }

    // Get admin account
    const adminAccount = await Account.findOne({ userId: req.userId });
    if (!adminAccount || adminAccount.balance < transferAmount) {
      return res.status(400).json({
        message: `Insufficient bank balance. Available: ₹${adminAccount ? adminAccount.balance.toLocaleString('en-IN') : 0}`,
      });
    }

    // IFSC validation
    const ifscUpper = ifsc ? ifsc.toUpperCase() : '';
    let bankName = 'External Bank';
    if (ifscUpper && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscUpper)) {
      const prefix = ifscUpper.substring(0, 4);
      bankName = BANK_MAP[prefix] || `Bank (${prefix})`;
    }

    // Generate UTR
    const prefix = ifscUpper ? ifscUpper.substring(0, 4) : 'NEFT';
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const utr = `${prefix}N${timestamp}${random}`;

    // Deduct from admin
    adminAccount.balance -= transferAmount;
    await adminAccount.save();

    // Check if recipient is in our system
    const recipientAccount = await Account.findOne({ accountNumber });
    let recipientUser = null;
    if (recipientAccount) {
      recipientAccount.balance += transferAmount;
      await recipientAccount.save();
      recipientUser = await User.findById(recipientAccount.userId);

      await Transaction.create({
        userId: recipientAccount.userId,
        type: 'credit',
        amount: transferAmount,
        category: 'Admin Transfer',
        sender: 'Bank Admin',
        description: description || `NEFT from Bank Admin | UTR: ${utr}`,
        status: 'success',
      });
    }

    // Record admin transaction
    await Transaction.create({
      userId: req.userId,
      type: 'debit',
      amount: transferAmount,
      category: 'Admin Withdrawal',
      receiver: beneficiaryName || (recipientUser ? recipientUser.name : accountNumber),
      description: description || `Admin NEFT to ${beneficiaryName || accountNumber} (${bankName}) | UTR: ${utr}`,
      status: 'success',
    });

    res.json({
      success: true,
      message: `₹${transferAmount.toLocaleString('en-IN')} sent successfully!`,
      utr,
      bankName,
      beneficiaryName: beneficiaryName || (recipientUser ? recipientUser.name : 'External'),
      accountNumber,
      ifsc: ifscUpper || 'N/A',
      amount: transferAmount,
      internalUser: !!recipientAccount,
      recipientName: recipientUser ? recipientUser.name : null,
      bankBalance: adminAccount.balance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Withdrawal failed.', error: error.message });
  }
};
