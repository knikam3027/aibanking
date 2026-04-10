const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const PostTransferVerification = require('../models/PostTransferVerification');

// Get admin dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const adminAccount = await Account.findOne({ userId: req.userId });

    // User stats
    const totalUsers = await User.countDocuments({ role: 'user' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await User.countDocuments({ role: 'user', createdAt: { $gte: today } });

    // Transaction stats
    const totalTransactions = await Transaction.countDocuments();
    const todayTransactions = await Transaction.countDocuments({ createdAt: { $gte: today } });
    const blockedTransactions = await Transaction.countDocuments({ status: 'blocked' });
    const todayBlocked = await Transaction.countDocuments({ status: 'blocked', createdAt: { $gte: today } });

    // Money flow today
    const todayTxns = await Transaction.find({ createdAt: { $gte: today } });
    const todayCredited = todayTxns.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
    const todayDebited = todayTxns.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);

    // Total money in the system (all user accounts)
    const allAccounts = await Account.find();
    const totalMoneyInSystem = allAccounts.reduce((sum, a) => sum + a.balance, 0);

    // Active users today (users who made transactions today)
    const activeToday = await Transaction.distinct('userId', { createdAt: { $gte: today } });

    // Recent alerts
    const recentAlerts = await Alert.countDocuments({ createdAt: { $gte: today } });
    const fraudAlerts = await Alert.countDocuments({ type: 'fraud', createdAt: { $gte: today } });

    // Top users by balance
    const topUsers = await Account.find({ userId: { $ne: req.userId } })
      .sort({ balance: -1 })
      .limit(5)
      .populate('userId', 'name email');

    // Weekly user registrations (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyUsers = await User.aggregate([
      { $match: { role: 'user', createdAt: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Weekly transaction volume
    const weeklyTxns = await Transaction.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, volume: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      bankBalance: adminAccount ? adminAccount.balance : 0,
      totalUsers,
      newUsersToday,
      activeUsersToday: activeToday.length,
      totalTransactions,
      todayTransactions,
      blockedTransactions,
      todayBlocked,
      todayCredited,
      todayDebited,
      totalMoneyInSystem,
      recentAlerts,
      fraudAlerts,
      topUsers: topUsers.map(a => ({
        name: a.userId?.name || 'Unknown',
        email: a.userId?.email || '',
        balance: a.balance,
        accountNumber: a.accountNumber,
      })),
      weeklyUsers,
      weeklyTxns,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Get all users list
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    const accounts = await Account.find();
    const accountMap = {};
    accounts.forEach(a => { accountMap[a.userId.toString()] = a; });

    const usersWithAccounts = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      createdAt: u.createdAt,
      account: accountMap[u._id.toString()] ? {
        accountNumber: accountMap[u._id.toString()].accountNumber,
        balance: accountMap[u._id.toString()].balance,
        accountType: accountMap[u._id.toString()].accountType,
      } : null,
    }));

    res.json(usersWithAccounts);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Add balance to single user
exports.addBalance = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid userId and positive amount are required.' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser || targetUser.role === 'admin') {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check admin bank balance
    const adminAccount = await Account.findOne({ userId: req.userId });
    if (!adminAccount || adminAccount.balance < amount) {
      return res.status(400).json({ message: `Insufficient bank balance. Available: ₹${adminAccount ? adminAccount.balance : 0}` });
    }

    const userAccount = await Account.findOne({ userId });
    if (!userAccount) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    // Deduct from admin, add to user
    adminAccount.balance -= amount;
    userAccount.balance += amount;
    await adminAccount.save();
    await userAccount.save();

    // Record transactions
    await Transaction.create({
      userId: req.userId,
      type: 'debit',
      amount,
      category: 'Admin Transfer',
      receiver: targetUser.name,
      description: description || `Balance added to ${targetUser.name}`,
      status: 'success',
    });

    await Transaction.create({
      userId,
      type: 'credit',
      amount,
      category: 'Admin Credit',
      sender: 'Bank Admin',
      description: description || 'Balance credited by Bank Admin',
      status: 'success',
    });

    res.json({
      message: `₹${amount} added to ${targetUser.name}'s account successfully.`,
      userNewBalance: userAccount.balance,
      bankNewBalance: adminAccount.balance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Add balance to multiple users at once
exports.addBalanceBulk = async (req, res) => {
  try {
    const { users, description } = req.body;
    // users = [{ userId, amount }, ...]
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Provide an array of users with userId and amount.' });
    }

    const totalAmount = users.reduce((sum, u) => sum + (u.amount || 0), 0);

    const adminAccount = await Account.findOne({ userId: req.userId });
    if (!adminAccount || adminAccount.balance < totalAmount) {
      return res.status(400).json({ message: `Insufficient bank balance. Need ₹${totalAmount}, available: ₹${adminAccount ? adminAccount.balance : 0}` });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const entry of users) {
      try {
        if (!entry.userId || !entry.amount || entry.amount <= 0) {
          results.push({ userId: entry.userId, status: 'failed', reason: 'Invalid userId or amount' });
          failCount++;
          continue;
        }

        const targetUser = await User.findById(entry.userId);
        if (!targetUser || targetUser.role === 'admin') {
          results.push({ userId: entry.userId, status: 'failed', reason: 'User not found' });
          failCount++;
          continue;
        }

        const userAccount = await Account.findOne({ userId: entry.userId });
        if (!userAccount) {
          results.push({ userId: entry.userId, status: 'failed', reason: 'Account not found' });
          failCount++;
          continue;
        }

        adminAccount.balance -= entry.amount;
        userAccount.balance += entry.amount;
        await userAccount.save();

        await Transaction.create({
          userId: req.userId,
          type: 'debit',
          amount: entry.amount,
          category: 'Admin Bulk Transfer',
          receiver: targetUser.name,
          description: description || `Bulk balance added to ${targetUser.name}`,
          status: 'success',
        });

        await Transaction.create({
          userId: entry.userId,
          type: 'credit',
          amount: entry.amount,
          category: 'Admin Credit',
          sender: 'Bank Admin',
          description: description || 'Bulk balance credited by Bank Admin',
          status: 'success',
        });

        results.push({ userId: entry.userId, name: targetUser.name, status: 'success', newBalance: userAccount.balance });
        successCount++;
      } catch (err) {
        results.push({ userId: entry.userId, status: 'failed', reason: err.message });
        failCount++;
      }
    }

    await adminAccount.save();

    res.json({
      message: `Bulk transfer complete. ${successCount} succeeded, ${failCount} failed.`,
      bankNewBalance: adminAccount.balance,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Get admin's own bank balance
exports.getBankBalance = async (req, res) => {
  try {
    const adminAccount = await Account.findOne({ userId: req.userId });
    res.json({ balance: adminAccount ? adminAccount.balance : 0 });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Get all held accounts
exports.getHeldAccounts = async (req, res) => {
  try {
    const heldAccounts = await Account.find({ isHeld: true }).populate('userId', 'name email phone');
    const results = [];

    for (const acc of heldAccounts) {
      // Get the verification that triggered the hold
      let verification = null;
      if (acc.heldByVerificationId) {
        verification = await PostTransferVerification.findById(acc.heldByVerificationId);
      }

      results.push({
        _id: acc._id,
        accountNumber: acc.accountNumber,
        balance: acc.balance,
        isHeld: acc.isHeld,
        heldAt: acc.heldAt,
        heldReason: acc.heldReason,
        user: acc.userId ? {
          _id: acc.userId._id,
          name: acc.userId.name,
          email: acc.userId.email,
          phone: acc.userId.phone,
        } : null,
        verification: verification ? {
          _id: verification._id,
          amount: verification.amount,
          receiverAccount: verification.receiverAccount,
          beneficiaryName: verification.beneficiaryName,
          status: verification.status,
          createdAt: verification.createdAt,
        } : null,
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Unhold an account (admin action after review)
exports.unholdAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { action, notes } = req.body; // action: 'unhold' or 'reverse_transaction'

    const account = await Account.findById(accountId);
    if (!account) return res.status(404).json({ message: 'Account not found.' });
    if (!account.isHeld) return res.json({ message: 'Account is not held.' });

    const user = await User.findById(account.userId);

    if (action === 'reverse_transaction' && account.heldByVerificationId) {
      // Reverse the suspicious transaction
      const verification = await PostTransferVerification.findById(account.heldByVerificationId);
      if (verification) {
        // Refund the amount back to sender
        account.balance += verification.amount;

        // Try to debit receiver if internal
        const receiverAcc = await Account.findOne({ accountNumber: verification.receiverAccount });
        if (receiverAcc && receiverAcc.balance >= verification.amount) {
          receiverAcc.balance -= verification.amount;
          await receiverAcc.save();
        }

        // Record reversal transaction
        await Transaction.create({
          userId: account.userId,
          type: 'credit',
          amount: verification.amount,
          category: 'Reversal',
          sender: 'Bank Admin',
          description: `[REVERSED] Suspicious transfer of ₹${verification.amount.toLocaleString('en-IN')} reversed by admin. ${notes || ''}`,
          status: 'success',
        });

        verification.status = 'failed';
        await verification.save();
      }
    }

    // Unhold the account
    account.isHeld = false;
    account.heldAt = null;
    account.heldReason = null;
    account.heldByVerificationId = null;
    await account.save();

    // Create alert
    await Alert.create({
      userId: account.userId,
      type: 'info',
      message: `✅ Your account has been reviewed and ${action === 'reverse_transaction' ? 'the suspicious transaction was reversed' : 'cleared'}. Your account is now active.${notes ? ' Admin notes: ' + notes : ''}`,
      severity: 'low',
    });

    res.json({
      message: `Account ${account.accountNumber} (${user?.name || 'Unknown'}) has been unholded.${action === 'reverse_transaction' ? ' Transaction reversed.' : ''}`,
      newBalance: account.balance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
