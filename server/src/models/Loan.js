const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'review'], default: 'pending' },
  interestRate: { type: Number },
  creditScoreType: { type: String, default: 'ai-based' },
  aiScore: { type: Number },
  reason: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
