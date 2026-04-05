const mongoose = require('mongoose');

const pendingTransferSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverAccount: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, default: 'Transfer' },
  description: { type: String },
  beneficiaryName: { type: String },
  ifsc: { type: String },
  phoneNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'calling', 'confirmed', 'declined', 'expired', 'completed', 'failed'],
    default: 'pending',
  },
  callSid: { type: String },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
  riskReason: { type: String },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) }, // 10 min
}, { timestamps: true });

pendingTransferSchema.index({ userId: 1, status: 1 });
pendingTransferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingTransfer', pendingTransferSchema);
