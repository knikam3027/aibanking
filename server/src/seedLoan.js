require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Loan = require('./models/Loan');
const Transaction = require('./models/Transaction');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: 'krishna@wipro.com' });
  if (!user) { console.log('User not found'); process.exit(1); }

  await Loan.deleteMany({ userId: user._id });

  const loan = await Loan.create({
    userId: user._id,
    amount: 200000,
    status: 'approved',
    interestRate: 10.5,
    creditScoreType: 'ai-based',
    aiScore: 780,
    reason: 'Approved: Good income pattern, steady cash flow, 9/12 EMIs paid on time.'
  });
  console.log('Loan created:', loan._id, 'Amount:', loan.amount);

  const emiAmount = 17584;
  const emiMonths = [
    '2025-07-05', '2025-08-05', '2025-09-05', '2025-10-05', '2025-11-05',
    '2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05'
  ];

  for (const dateStr of emiMonths) {
    await Transaction.create({
      userId: user._id,
      type: 'debit',
      amount: emiAmount,
      category: 'EMI',
      description: 'Personal Loan EMI - ICICI Bank (Loan: ' + loan._id + ')',
      receiver: 'ICICI Bank Loan',
      sender: 'Krishna Nikam',
      status: 'success',
      createdAt: new Date(dateStr + 'T10:00:00.000Z'),
      updatedAt: new Date(dateStr + 'T10:00:00.000Z'),
    });
  }
  console.log('9 EMI transactions created (Jul 2025 - Mar 2026)');
  await mongoose.disconnect();
  console.log('Done!');
})();
