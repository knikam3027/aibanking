const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Alert = require('../models/Alert');
const User = require('../models/User');
const PendingTransfer = require('../models/PendingTransfer');
const axios = require('axios');
const { makeVerificationCall, getCallStatus, assessTransferRisk } = require('../services/exotelService');

exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

exports.transfer = async (req, res) => {
  try {
    const { receiverAccount, amount, category, description } = req.body;

    if (!receiverAccount || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid transfer details.' });
    }

    const senderAcc = await Account.findOne({ userId: req.userId });
    if (!senderAcc) return res.status(404).json({ message: 'Sender account not found.' });

    if (senderAcc.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    const receiverAcc = await Account.findOne({ accountNumber: receiverAccount });
    if (!receiverAcc) return res.status(404).json({ message: 'Receiver account not found.' });

    if (senderAcc.accountNumber === receiverAccount) {
      return res.status(400).json({ message: 'Cannot transfer to your own account.' });
    }

    // Fraud check via AI service
    let fraudResult = { is_fraud: false };
    try {
      const recentTxns = await Transaction.find({ userId: req.userId })
        .sort({ createdAt: -1 }).limit(10);
      const response = await axios.post(`${process.env.AI_SERVICE_URL}/fraud-check`, {
        amount,
        balance: senderAcc.balance,
        recent_transactions: recentTxns.map(t => ({ amount: t.amount, type: t.type, createdAt: t.createdAt })),
      }, { timeout: 5000 });
      fraudResult = response.data;
    } catch {
      // AI service unavailable, proceed without fraud check
    }

    if (fraudResult.is_fraud) {
      await Alert.create({
        userId: req.userId,
        type: 'fraud',
        message: fraudResult.reason || 'Suspicious transaction detected and blocked.',
        severity: 'high',
      });

      await Transaction.create({
        userId: req.userId,
        type: 'debit',
        amount,
        category: category || 'Transfer',
        receiver: receiverAccount,
        description,
        status: 'blocked',
      });

      return res.status(403).json({
        message: 'Transaction blocked due to suspicious activity.',
        fraud: true,
        reason: fraudResult.reason,
      });
    }

    // Execute transfer
    senderAcc.balance -= amount;
    receiverAcc.balance += amount;
    await senderAcc.save();
    await receiverAcc.save();

    const senderUser = await User.findById(req.userId);
    const receiverUser = await User.findById(receiverAcc.userId);

    // Record sender transaction
    const txn = await Transaction.create({
      userId: req.userId,
      type: 'debit',
      amount,
      category: category || 'Transfer',
      receiver: receiverUser ? receiverUser.name : receiverAccount,
      description,
      status: 'success',
    });

    // Record receiver transaction
    await Transaction.create({
      userId: receiverAcc.userId,
      type: 'credit',
      amount,
      category: category || 'Transfer',
      sender: senderUser ? senderUser.name : 'Unknown',
      description: `Transfer from ${senderUser ? senderUser.name : 'Unknown'}`,
      status: 'success',
    });

    res.json({ message: 'Transfer successful.', transaction: txn, newBalance: senderAcc.balance });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

/**
 * Initiate a voice-verified transfer.
 * Runs risk assessment → creates pending transfer → triggers Exotel call.
 */
exports.transferWithVoice = async (req, res) => {
  try {
    const { receiverAccount, amount, category, description, beneficiaryName, ifsc, phoneNumber } = req.body;

    if (!receiverAccount || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid transfer details.' });
    }
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number required for voice verification.' });
    }

    const senderAcc = await Account.findOne({ userId: req.userId });
    if (!senderAcc) return res.status(404).json({ message: 'Sender account not found.' });

    if (senderAcc.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Risk assessment
    const recentTxns = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(20);
    const risk = assessTransferRisk(amount, senderAcc.balance, recentTxns);

    // Create pending transfer
    const pending = await PendingTransfer.create({
      userId: req.userId,
      receiverAccount,
      amount: Number(amount),
      category: category || 'Transfer',
      description: description || '',
      beneficiaryName: beneficiaryName || '',
      ifsc: ifsc || '',
      phoneNumber,
      status: 'pending',
      riskLevel: risk.level,
      riskReason: risk.reason,
    });

    // Trigger Exotel voice call
    const callResult = await makeVerificationCall(phoneNumber, pending._id.toString());

    if (callResult.success) {
      pending.status = 'calling';
      if (callResult.callSid) pending.callSid = callResult.callSid;
      await pending.save();
    }
    // Even if call fails, the pending transfer stays for simulation/manual flow

    res.json({
      message: 'Voice verification initiated.',
      pendingTransferId: pending._id,
      status: pending.status,
      riskLevel: risk.level,
      riskReason: risk.reason,
      callInitiated: callResult.success,
      callReason: callResult.reason || null,
      phoneNumber: phoneNumber.replace(/.(?=.{4})/g, '*'), // Mask number
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

/**
 * Check status of a pending voice-verified transfer.
 * Also polls Exotel call status when a callSid exists.
 */
exports.getPendingTransferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await PendingTransfer.findOne({ _id: id, userId: req.userId });

    if (!pending) {
      return res.status(404).json({ message: 'Pending transfer not found.' });
    }

    // Check expiry
    if (pending.expiresAt < new Date() && ['pending', 'calling'].includes(pending.status)) {
      pending.status = 'expired';
      await pending.save();
    }

    // Poll Exotel call status if we have a callSid and transfer is still in progress
    let callStatus = null;
    if (pending.callSid && ['pending', 'calling'].includes(pending.status)) {
      callStatus = await getCallStatus(pending.callSid);
      if (callStatus) {
        // Update status based on Exotel call result
        if (['completed'].includes(callStatus.status)) {
          // Call was answered and completed — mark as confirmed (waiting for user action in UI)
          pending.status = 'confirmed';
          await pending.save();
        } else if (['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus.status)) {
          pending.status = 'expired';
          await pending.save();
        }
      }
    }

    let newBalance = null;
    if (pending.status === 'completed') {
      const acc = await Account.findOne({ userId: req.userId });
      if (acc) newBalance = acc.balance;
    }

    res.json({
      id: pending._id,
      status: pending.status,
      amount: pending.amount,
      receiverAccount: pending.receiverAccount,
      beneficiaryName: pending.beneficiaryName,
      riskLevel: pending.riskLevel,
      riskReason: pending.riskReason,
      newBalance,
      createdAt: pending.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
