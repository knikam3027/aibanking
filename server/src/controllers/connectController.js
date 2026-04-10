const PostTransferVerification = require('../models/PostTransferVerification');
const Account = require('../models/Account');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { getVerificationResult } = require('../services/awsConnectService');

/**
 * Get verification status for a post-transfer verification call.
 * Also polls AWS Connect contact attributes when contactId exists.
 */
exports.getVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await PostTransferVerification.findOne({ _id: id, userId: req.userId });

    if (!verification) {
      return res.status(404).json({ message: 'Verification not found.' });
    }

    // If still in calling state, poll AWS Connect
    if (['pending', 'calling'].includes(verification.status) && verification.contactId) {
      const result = await getVerificationResult(verification.contactId);

      if (result.status === 'completed') {
        verification.verificationResult = result.verificationResult;

        if (result.verificationResult === 'confirmed') {
          verification.status = 'confirmed';
        } else if (result.verificationResult === 'suspicious') {
          verification.status = 'suspicious';
          // Hold the account
          await holdAccount(verification);
        } else {
          verification.status = 'no_response';
          // Also hold for safety on no response
          await holdAccount(verification);
        }
        await verification.save();
      } else if (result.status === 'in_progress') {
        if (verification.status === 'pending') {
          verification.status = 'calling';
          await verification.save();
        }
      }
    }

    // Check expiry
    if (verification.expiresAt < new Date() && ['pending', 'calling'].includes(verification.status)) {
      verification.status = 'expired';
      await verification.save();
    }

    res.json({
      status: verification.status,
      amount: verification.amount,
      receiverAccount: verification.receiverAccount,
      beneficiaryName: verification.beneficiaryName,
      verificationResult: verification.verificationResult,
      accountHeld: verification.accountHeld,
      createdAt: verification.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

/**
 * Simulate verification response (for local testing without AWS Connect).
 * digit: 1 = confirmed, 2 = suspicious
 */
exports.simulateVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { digit } = req.body;
    const verification = await PostTransferVerification.findById(id);

    if (!verification) {
      return res.status(404).json({ message: 'Verification not found.' });
    }

    if (!['pending', 'calling'].includes(verification.status)) {
      return res.json({ message: `Verification already ${verification.status}.`, status: verification.status });
    }

    if (digit === 1 || digit === '1') {
      verification.status = 'confirmed';
      verification.verificationResult = 'confirmed';
      await verification.save();

      return res.json({
        message: 'Transfer confirmed. No suspicious activity.',
        status: 'confirmed',
        accountHeld: false,
      });
    } else if (digit === 2 || digit === '2') {
      verification.status = 'suspicious';
      verification.verificationResult = 'suspicious';
      await verification.save();

      // Hold the account
      await holdAccount(verification);

      return res.json({
        message: 'Transaction flagged as suspicious. Account has been temporarily held.',
        status: 'suspicious',
        accountHeld: true,
      });
    } else {
      return res.status(400).json({ message: 'Invalid digit. Use 1 (confirm) or 2 (suspicious).' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

/**
 * Hold the sender's account when transaction is flagged suspicious.
 */
async function holdAccount(verification) {
  try {
    const account = await Account.findOne({ userId: verification.userId });
    if (!account) return;

    account.isHeld = true;
    account.heldAt = new Date();
    account.heldReason = `Transaction of ₹${verification.amount.toLocaleString('en-IN')} to ${verification.receiverAccount} flagged as suspicious via voice verification.`;
    account.heldByVerificationId = verification._id;
    await account.save();

    verification.accountHeld = true;
    await verification.save();

    // Create fraud alert
    const user = await User.findById(verification.userId);
    await Alert.create({
      userId: verification.userId,
      type: 'fraud',
      message: `⚠️ Account HELD: ${user?.name || 'User'} reported transfer of ₹${verification.amount.toLocaleString('en-IN')} to ${verification.receiverAccount} as suspicious. Account temporarily frozen pending admin review.`,
      severity: 'critical',
    });

    console.log(`[Account Hold] Account ${account.accountNumber} held for user ${verification.userId}`);
  } catch (error) {
    console.error('[Account Hold] Error:', error.message);
  }
}
