const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const PayrollBatch = require('../models/PayrollBatch');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Upload & parse salary PDF
exports.uploadSalaryPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file.' });
    }

    // Send file to AI service for parsing
    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: 'application/pdf',
    });

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/parse-salary-pdf`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (!aiResponse.data.success) {
      return res.status(400).json({ message: aiResponse.data.error || 'Failed to parse PDF.' });
    }

    if (aiResponse.data.employees.length === 0) {
      return res.status(400).json({ message: 'No employee salary data found in the PDF. Please ensure the PDF has columns like Name, Account Number, IFSC, and Salary.' });
    }

    // Save to database
    const batch = await PayrollBatch.create({
      adminId: req.userId,
      fileName: req.file.originalname,
      employees: aiResponse.data.employees,
      totalAmount: aiResponse.data.total_amount,
      status: 'parsed',
    });

    res.json({
      message: `PDF parsed successfully. Found ${aiResponse.data.count} employees.`,
      batch: {
        _id: batch._id,
        fileName: batch.fileName,
        employees: batch.employees,
        totalAmount: batch.totalAmount,
        status: batch.status,
        createdAt: batch.createdAt,
      },
    });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('PDF upload error:', error.message);
    res.status(500).json({ message: 'Failed to process PDF.', error: error.message });
  }
};

// Verify accounts - send ₹1 token to each account
exports.verifyAccounts = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await PayrollBatch.findOne({ _id: batchId, adminId: req.userId });

    if (!batch) {
      return res.status(404).json({ message: 'Payroll batch not found.' });
    }

    if (batch.status !== 'parsed' && batch.status !== 'verified') {
      return res.status(400).json({ message: `Cannot verify. Batch is in ${batch.status} status.` });
    }

    batch.status = 'verifying';

    const adminAccount = await Account.findOne({ userId: req.userId });
    const verificationCost = batch.employees.length * 1; // ₹1 per account

    if (!adminAccount || adminAccount.balance < verificationCost) {
      return res.status(400).json({
        message: `Insufficient balance for verification. Need ₹${verificationCost} (₹1 × ${batch.employees.length} accounts). Available: ₹${adminAccount ? adminAccount.balance : 0}`,
      });
    }

    let verifiedCount = 0;
    let failedCount = 0;

    for (const emp of batch.employees) {
      // Simulate NEFT ₹1 verification
      // In production, this would call a real banking API (Razorpay/Cashfree/ICICI API)
      const verification = _simulateAccountVerification(emp);

      if (verification.success) {
        emp.verified = true;
        emp.status = 'verified';
        emp.verificationNote = `Account verified. Name match: ${verification.nameMatch ? 'Yes' : 'Partial'}. ₹1 token sent.`;
        verifiedCount++;
      } else {
        emp.verified = false;
        emp.status = 'verification_failed';
        emp.verificationNote = verification.reason;
        failedCount++;
      }
    }

    // Deduct verification cost from admin
    adminAccount.balance -= verifiedCount; // ₹1 per verified account
    await adminAccount.save();

    // Record verification transaction
    if (verifiedCount > 0) {
      await Transaction.create({
        userId: req.userId,
        type: 'debit',
        amount: verifiedCount,
        category: 'Account Verification',
        receiver: 'NEFT Verification',
        description: `₹1 token verification for ${verifiedCount} payroll accounts`,
        status: 'success',
      });
    }

    batch.status = failedCount === batch.employees.length ? 'parsed' : 'verified';
    await batch.save();

    res.json({
      message: `Verification complete. ${verifiedCount} verified, ${failedCount} failed.`,
      verifiedCount,
      failedCount,
      employees: batch.employees,
      bankBalance: adminAccount.balance,
    });
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(500).json({ message: 'Verification failed.', error: error.message });
  }
};

// Get batch for review (before confirming payment)
exports.reviewBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await PayrollBatch.findOne({ _id: batchId, adminId: req.userId });

    if (!batch) {
      return res.status(404).json({ message: 'Payroll batch not found.' });
    }

    const adminAccount = await Account.findOne({ userId: req.userId });
    const verifiedEmployees = batch.employees.filter(e => e.verified);
    const totalToPay = verifiedEmployees.reduce((sum, e) => sum + e.salary, 0);

    res.json({
      batch: {
        _id: batch._id,
        fileName: batch.fileName,
        status: batch.status,
        createdAt: batch.createdAt,
        totalAmount: batch.totalAmount,
      },
      employees: batch.employees,
      summary: {
        total: batch.employees.length,
        verified: verifiedEmployees.length,
        failed: batch.employees.filter(e => e.status === 'verification_failed').length,
        totalToPay,
        bankBalance: adminAccount ? adminAccount.balance : 0,
        sufficient: adminAccount ? adminAccount.balance >= totalToPay : false,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Confirm and process salary payments
exports.confirmAndPay = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await PayrollBatch.findOne({ _id: batchId, adminId: req.userId });

    if (!batch) {
      return res.status(404).json({ message: 'Payroll batch not found.' });
    }

    if (batch.status === 'completed') {
      return res.status(400).json({ message: 'This batch has already been paid.' });
    }

    if (batch.status === 'processing') {
      return res.status(400).json({ message: 'Payment is already being processed.' });
    }

    const verifiedEmployees = batch.employees.filter(e => e.verified && e.status === 'verified');

    if (verifiedEmployees.length === 0) {
      return res.status(400).json({ message: 'No verified accounts to pay. Please verify accounts first.' });
    }

    const totalToPay = verifiedEmployees.reduce((sum, e) => sum + e.salary, 0);

    // Check admin balance
    const adminAccount = await Account.findOne({ userId: req.userId });
    if (!adminAccount || adminAccount.balance < totalToPay) {
      return res.status(400).json({
        message: `Insufficient bank balance. Need ₹${totalToPay.toLocaleString('en-IN')}, available: ₹${adminAccount ? adminAccount.balance.toLocaleString('en-IN') : 0}`,
      });
    }

    batch.status = 'processing';
    await batch.save();

    let paidCount = 0;
    let failedCount = 0;
    let totalPaid = 0;
    const results = [];

    for (const emp of batch.employees) {
      if (!emp.verified || emp.status !== 'verified') {
        results.push({ name: emp.name, status: 'skipped', reason: 'Not verified' });
        continue;
      }

      try {
        // Simulate NEFT payment
        const payment = _simulateNeftPayment(emp);

        if (payment.success) {
          emp.status = 'paid';
          emp.utr = payment.utr;
          emp.paidAt = new Date();
          paidCount++;
          totalPaid += emp.salary;

          // Record transaction for admin (debit)
          await Transaction.create({
            userId: req.userId,
            type: 'debit',
            amount: emp.salary,
            category: 'Salary Payment',
            receiver: emp.name,
            description: `Salary NEFT to ${emp.name} (${emp.accountNumber}) | UTR: ${payment.utr}`,
            status: 'success',
          });

          // Check if employee has account in our system — credit their balance
          const empAccount = await Account.findOne({ accountNumber: emp.accountNumber });
          if (empAccount) {
            empAccount.balance += emp.salary;
            await empAccount.save();

            await Transaction.create({
              userId: empAccount.userId,
              type: 'credit',
              amount: emp.salary,
              category: 'Salary',
              sender: 'Bank Admin',
              description: `Salary credited via NEFT | UTR: ${payment.utr}`,
              status: 'success',
            });
          }

          results.push({ name: emp.name, status: 'paid', utr: payment.utr, amount: emp.salary });
        } else {
          emp.status = 'payment_failed';
          failedCount++;
          results.push({ name: emp.name, status: 'failed', reason: payment.reason });
        }
      } catch (err) {
        emp.status = 'payment_failed';
        failedCount++;
        results.push({ name: emp.name, status: 'failed', reason: err.message });
      }
    }

    // Deduct total from admin
    adminAccount.balance -= totalPaid;
    await adminAccount.save();

    batch.paidCount = paidCount;
    batch.failedCount = failedCount;
    batch.status = failedCount === 0 ? 'completed' : (paidCount === 0 ? 'failed' : 'completed');
    await batch.save();

    res.json({
      message: `Salary payment complete! ${paidCount} paid, ${failedCount} failed.`,
      totalPaid,
      bankBalance: adminAccount.balance,
      paidCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error('Payment error:', error.message);
    res.status(500).json({ message: 'Payment processing failed.', error: error.message });
  }
};

// Get all payroll batches for admin
exports.getBatches = async (req, res) => {
  try {
    const batches = await PayrollBatch.find({ adminId: req.userId })
      .sort({ createdAt: -1 })
      .select('fileName status totalAmount paidCount failedCount createdAt employees');

    res.json(batches.map(b => ({
      _id: b._id,
      fileName: b.fileName,
      status: b.status,
      totalAmount: b.totalAmount,
      employeeCount: b.employees.length,
      paidCount: b.paidCount,
      failedCount: b.failedCount,
      createdAt: b.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// Get single batch details
exports.getBatchDetails = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await PayrollBatch.findOne({ _id: batchId, adminId: req.userId });

    if (!batch) {
      return res.status(404).json({ message: 'Payroll batch not found.' });
    }

    const adminAccount = await Account.findOne({ userId: req.userId });

    res.json({
      batch: {
        _id: batch._id,
        fileName: batch.fileName,
        status: batch.status,
        totalAmount: batch.totalAmount,
        paidCount: batch.paidCount,
        failedCount: batch.failedCount,
        createdAt: batch.createdAt,
      },
      employees: batch.employees,
      bankBalance: adminAccount ? adminAccount.balance : 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};


// ============== SIMULATION HELPERS ==============
// In production, replace these with real banking API calls (Razorpay, Cashfree, ICICI API etc.)

function _simulateAccountVerification(emp) {
  // Simulate ₹1 NEFT verification
  // Validates account number format and IFSC format
  const accNum = emp.accountNumber || '';
  const ifsc = emp.ifsc || '';

  if (accNum.length < 8 || accNum.length > 18) {
    return { success: false, reason: `Invalid account number length (${accNum.length} digits). Expected 8-18 digits.`, nameMatch: false };
  }

  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return { success: false, reason: `Invalid IFSC format: ${ifsc}. Expected format like SBIN0001234.`, nameMatch: false };
  }

  // Simulate name matching (in production, bank API returns registered name)
  // 95% success rate simulation
  const isSuccess = Math.random() > 0.05;
  if (!isSuccess) {
    return { success: false, reason: 'Bank returned: Account not found or inactive.', nameMatch: false };
  }

  return { success: true, nameMatch: true };
}

function _simulateNeftPayment(emp) {
  // Simulate NEFT payment
  // Generate a realistic UTR number
  const bankPrefix = emp.ifsc ? emp.ifsc.substring(0, 4) : 'BANK';
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const utr = `${bankPrefix}N${timestamp}${random}`;

  // 98% success rate for verified accounts
  const isSuccess = Math.random() > 0.02;
  if (!isSuccess) {
    return { success: false, reason: 'NEFT transfer failed: Bank server timeout. Please retry.', utr: '' };
  }

  return { success: true, utr };
}
