const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: 'Alert not found.' });
    res.json(alert);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// AI Smart Notifications — generate context-aware alerts
exports.generateSmartAlerts = async (req, res) => {
  try {
    const account = await Account.findOne({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50);

    const balance = account ? account.balance : 0;
    const debits = transactions.filter(t => t.type === 'debit');
    const credits = transactions.filter(t => t.type === 'credit');
    const totalSpent = debits.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = credits.reduce((sum, t) => sum + t.amount, 0);

    const newAlerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for existing alerts today to avoid duplicates
    const todayAlerts = await Alert.countDocuments({
      userId: req.userId,
      createdAt: { $gte: today },
    });
    if (todayAlerts >= 5) {
      return res.json({ generated: 0, message: 'Daily alert limit reached.' });
    }

    // 1. Salary credited alert
    const recentCredits = credits.filter(t => t.amount >= 10000);
    const lastSalary = recentCredits[0];
    if (lastSalary) {
      const salaryDate = new Date(lastSalary.createdAt);
      const hoursSince = (Date.now() - salaryDate.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 48) {
        const exists = await Alert.findOne({
          userId: req.userId,
          message: { $regex: 'salary.*credited|income.*received' },
          createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        });
        if (!exists) {
          newAlerts.push({
            userId: req.userId,
            type: 'info',
            message: `💰 Your income of ₹${lastSalary.amount.toLocaleString('en-IN')} was received! Save ₹${Math.round(lastSalary.amount * 0.2).toLocaleString('en-IN')} (20%) now for your goals.`,
            severity: 'low',
          });
        }
      }
    }

    // 2. Unusual spending alert
    const avgDaily = totalSpent / Math.max(debits.length, 1);
    const todayDebits = debits.filter(t => new Date(t.createdAt) >= today);
    const todaySpent = todayDebits.reduce((sum, t) => sum + t.amount, 0);
    if (todaySpent > avgDaily * 2.5 && todaySpent > 500) {
      newAlerts.push({
        userId: req.userId,
        type: 'warning',
        message: `⚠️ You've spent ₹${todaySpent.toLocaleString('en-IN')} today — that's ${(todaySpent / avgDaily).toFixed(1)}x your average! Consider pausing non-essential purchases.`,
        severity: 'medium',
      });
    }

    // 3. Low balance warning
    if (balance < avgDaily * 7 && balance > 0 && avgDaily > 0) {
      const daysLeft = Math.floor(balance / avgDaily);
      const exists = await Alert.findOne({
        userId: req.userId,
        type: 'warning',
        message: { $regex: 'balance.*last|running.*low' },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      if (!exists) {
        newAlerts.push({
          userId: req.userId,
          type: 'warning',
          message: `🚨 Low balance alert! ₹${balance.toLocaleString('en-IN')} may only last ~${daysLeft} days at your current spending rate.`,
          severity: 'high',
        });
      }
    }

    // 4. Subscription renewal prediction
    const subKeywords = ['netflix', 'spotify', 'prime', 'hotstar', 'jio', 'airtel', 'youtube'];
    for (const t of debits) {
      const recv = (t.receiver || '').toLowerCase();
      const hasSub = subKeywords.some(s => recv.includes(s));
      if (hasSub) {
        const txnDate = new Date(t.createdAt);
        const nextRenewal = new Date(txnDate);
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        const daysUntil = Math.ceil((nextRenewal - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntil > 0 && daysUntil <= 3) {
          newAlerts.push({
            userId: req.userId,
            type: 'prediction',
            message: `📱 ${t.receiver} subscription (₹${t.amount.toLocaleString('en-IN')}) likely renews in ${daysUntil} day(s). Review if you still need it.`,
            severity: 'low',
          });
          break; // Only one sub alert
        }
      }
    }

    // 5. Spending pattern insight
    const categories = {};
    debits.forEach(t => {
      const cat = t.category || 'General';
      categories[cat] = (categories[cat] || 0) + t.amount;
    });
    const topCat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    if (topCat && totalSpent > 0) {
      const pct = (topCat[1] / totalSpent * 100);
      if (pct > 40) {
        newAlerts.push({
          userId: req.userId,
          type: 'info',
          message: `📊 AI Insight: ${topCat[0]} is ${pct.toFixed(0)}% of your spending (₹${topCat[1].toLocaleString('en-IN')}). Reducing by 15% could save ₹${Math.round(topCat[1] * 0.15).toLocaleString('en-IN')}/month.`,
          severity: 'low',
        });
      }
    }

    // 6. Financial health score
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome * 100) : 0;
    const healthScore = Math.min(100, Math.max(0, Math.round(50 + savingsRate)));
    if (healthScore < 40) {
      newAlerts.push({
        userId: req.userId,
        type: 'warning',
        message: `📉 Your financial health score is ${healthScore}/100. You're spending more than you earn. Create a budget to get back on track.`,
        severity: 'high',
      });
    }

    // Save alerts
    if (newAlerts.length > 0) {
      await Alert.insertMany(newAlerts);
    }

    res.json({ generated: newAlerts.length, alerts: newAlerts });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
