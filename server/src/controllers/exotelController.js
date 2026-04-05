const PendingTransfer = require('../models/PendingTransfer');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Alert = require('../models/Alert');

/**
 * Serve ExoML IVR document for Exotel.
 * Called by Exotel when the call connects — tells the IVR what to say.
 * PUBLIC endpoint — no auth required.
 */
exports.serveIVR = async (req, res) => {
  try {
    const { transferId } = req.params;
    const pending = await PendingTransfer.findById(transferId);

    if (!pending || pending.status === 'expired') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female" language="en-IN">This transfer request has expired or is invalid. Goodbye.</Say>
  <Hangup/>
</Response>`;
      res.set('Content-Type', 'application/xml');
      return res.send(xml);
    }

    const amountWords = pending.amount.toLocaleString('en-IN');
    const callbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/exotel/callback/${transferId}`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${callbackUrl}" method="POST" numDigits="1" timeout="15">
    <Say voice="female" language="en-IN">
      Hello. This is AI Banking security verification.
      You have a transfer request of Rupees ${amountWords} to account ending ${pending.receiverAccount.slice(-4)}.
      Beneficiary name: ${pending.beneficiaryName || 'Not specified'}.
      Press 1 to confirm this transfer.
      Press 2 to decline this transfer.
    </Say>
  </Gather>
  <Say voice="female" language="en-IN">
    We did not receive any input. The transfer has been cancelled for your safety. Goodbye.
  </Say>
  <Hangup/>
</Response>`;

    // Update status to calling
    if (pending.status === 'pending') {
      pending.status = 'calling';
      await pending.save();
    }

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('[Exotel IVR] Error:', error.message);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female" language="en-IN">An error occurred. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  }
};

/**
 * Handle Exotel IVR callback — user pressed a digit.
 * PUBLIC endpoint — no auth required.
 */
exports.handleCallback = async (req, res) => {
  try {
    const { transferId } = req.params;
    const digits = req.body.digits || req.query.digits;
    const callSid = req.body.CallSid || req.query.CallSid;

    console.log(`[Exotel Callback] Transfer: ${transferId}, Digits: ${digits}, CallSid: ${callSid}`);

    const pending = await PendingTransfer.findById(transferId);
    if (!pending) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="female" language="en-IN">Transfer not found. Goodbye.</Say><Hangup/></Response>`;
      res.set('Content-Type', 'application/xml');
      return res.send(xml);
    }

    if (pending.status === 'completed' || pending.status === 'declined') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="female" language="en-IN">This transfer has already been processed. Goodbye.</Say><Hangup/></Response>`;
      res.set('Content-Type', 'application/xml');
      return res.send(xml);
    }

    if (callSid) pending.callSid = callSid;

    if (digits === '1') {
      // User confirmed — execute the transfer
      const result = await executeTransfer(pending);
      if (result.success) {
        pending.status = 'completed';
        await pending.save();
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female" language="en-IN">
    Your transfer of Rupees ${pending.amount.toLocaleString('en-IN')} has been confirmed and processed successfully.
    Your new balance is Rupees ${result.newBalance.toLocaleString('en-IN')}.
    Thank you for using AI Banking. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
        res.set('Content-Type', 'application/xml');
        return res.send(xml);
      } else {
        pending.status = 'failed';
        await pending.save();
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female" language="en-IN">
    Sorry, the transfer could not be processed. Reason: ${result.reason}. Please try again from the app. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
        res.set('Content-Type', 'application/xml');
        return res.send(xml);
      }
    } else if (digits === '2') {
      // User declined
      pending.status = 'declined';
      await pending.save();

      // Create fraud alert
      await Alert.create({
        userId: pending.userId,
        type: 'warning',
        message: `Transfer of ₹${pending.amount.toLocaleString('en-IN')} was declined via voice verification.`,
        severity: 'medium',
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female" language="en-IN">
    The transfer has been declined. Your account is safe. If you did not initiate this, please contact support immediately. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
      res.set('Content-Type', 'application/xml');
      return res.send(xml);
    } else {
      // Invalid input — re-prompt
      const callbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/exotel/callback/${transferId}`;
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${callbackUrl}" method="POST" numDigits="1" timeout="10">
    <Say voice="female" language="en-IN">
      Invalid input. Please press 1 to confirm or press 2 to decline the transfer.
    </Say>
  </Gather>
  <Say voice="female" language="en-IN">No input received. Transfer cancelled for safety. Goodbye.</Say>
  <Hangup/>
</Response>`;
      res.set('Content-Type', 'application/xml');
      return res.send(xml);
    }
  } catch (error) {
    console.error('[Exotel Callback] Error:', error.message);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="female" language="en-IN">An error occurred. Transfer cancelled. Goodbye.</Say><Hangup/></Response>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  }
};

/**
 * Exotel call status update callback.
 * PUBLIC endpoint — no auth required.
 */
exports.handleStatusCallback = async (req, res) => {
  try {
    const { transferId } = req.params;
    const status = req.body.Status || req.query.Status;
    const callSid = req.body.CallSid || req.query.CallSid;

    console.log(`[Exotel Status] Transfer: ${transferId}, Status: ${status}, CallSid: ${callSid}`);

    const pending = await PendingTransfer.findById(transferId);
    if (pending && callSid) {
      pending.callSid = callSid;

      // If call was not answered or failed, mark as expired
      if (['no-answer', 'busy', 'failed', 'canceled'].includes(status)) {
        if (pending.status === 'pending' || pending.status === 'calling') {
          pending.status = 'expired';
        }
      }
      await pending.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Exotel Status] Error:', error.message);
    res.json({ success: false });
  }
};

/**
 * Simulate voice call response (for local testing without Exotel).
 * PUBLIC endpoint for testing — accepts digit 1 or 2.
 */
exports.simulateCallback = async (req, res) => {
  try {
    const { transferId } = req.params;
    const { digit } = req.body; // 1 = confirm, 2 = decline

    const pending = await PendingTransfer.findById(transferId);
    if (!pending) {
      return res.status(404).json({ message: 'Pending transfer not found.' });
    }

    if (['completed', 'declined', 'expired'].includes(pending.status)) {
      return res.json({ message: `Transfer already ${pending.status}.`, status: pending.status });
    }

    if (digit === 1 || digit === '1') {
      const result = await executeTransfer(pending);
      if (result.success) {
        pending.status = 'completed';
        await pending.save();
        return res.json({
          message: 'Transfer confirmed and completed via voice verification.',
          status: 'completed',
          newBalance: result.newBalance,
        });
      } else {
        pending.status = 'failed';
        await pending.save();
        return res.json({ message: result.reason, status: 'failed' });
      }
    } else if (digit === 2 || digit === '2') {
      pending.status = 'declined';
      await pending.save();

      await Alert.create({
        userId: pending.userId,
        type: 'warning',
        message: `Transfer of ₹${pending.amount.toLocaleString('en-IN')} was declined via voice verification.`,
        severity: 'medium',
      });

      return res.json({ message: 'Transfer declined.', status: 'declined' });
    } else {
      return res.status(400).json({ message: 'Invalid digit. Use 1 (confirm) or 2 (decline).' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

/**
 * Execute the actual money transfer after voice confirmation.
 */
async function executeTransfer(pending) {
  try {
    const senderAcc = await Account.findOne({ userId: pending.userId });
    if (!senderAcc) return { success: false, reason: 'Sender account not found' };

    if (senderAcc.balance < pending.amount) {
      return { success: false, reason: 'Insufficient balance' };
    }

    // Debit sender
    senderAcc.balance -= pending.amount;
    await senderAcc.save();

    const senderUser = await User.findById(pending.userId);

    // Credit receiver if internal account exists
    const receiverAcc = await Account.findOne({ accountNumber: pending.receiverAccount });
    if (receiverAcc) {
      receiverAcc.balance += pending.amount;
      await receiverAcc.save();

      const receiverUser = await User.findById(receiverAcc.userId);
      await Transaction.create({
        userId: receiverAcc.userId,
        type: 'credit',
        amount: pending.amount,
        category: pending.category || 'Transfer',
        sender: senderUser ? senderUser.name : 'Unknown',
        description: `Transfer from ${senderUser ? senderUser.name : 'Unknown'} [Voice Verified]`,
        status: 'success',
      });
    }

    // Record sender transaction (NEFT / external transfer)
    await Transaction.create({
      userId: pending.userId,
      type: 'debit',
      amount: pending.amount,
      category: pending.category || 'Transfer',
      receiver: pending.beneficiaryName || pending.receiverAccount,
      description: `[Voice Verified] ${pending.ifsc ? 'NEFT ' + pending.ifsc + ' ' : ''}${pending.description || ''}`.trim(),
      status: 'success',
    });

    return { success: true, newBalance: senderAcc.balance };
  } catch (error) {
    console.error('[Execute Transfer] Error:', error.message);
    return { success: false, reason: error.message };
  }
}
