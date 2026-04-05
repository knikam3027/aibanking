const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  category: { type: String, default: 'General' },
  receiver: { type: String },
  sender: { type: String },
  description: { type: String },
  status: { type: String, enum: ['success', 'failed', 'pending', 'blocked'], default: 'success' },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
