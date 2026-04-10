const mongoose = require('mongoose');

const postTransferVerificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  receiverAccount: { type: String, required: true },
  amount: { type: Number, required: true },
  beneficiaryName: { type: String, default: '' },
  phoneNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'calling', 'confirmed', 'suspicious', 'no_response', 'failed', 'expired'],
    default: 'pending',
  },
  contactId: { type: String }, // AWS Connect Contact ID
  verificationResult: { type: String }, // confirmed / suspicious / no_response
  accountHeld: { type: Boolean, default: false },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 15 * 60 * 1000) }, // 15 min TTL
}, { timestamps: true });

postTransferVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
postTransferVerificationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('PostTransferVerification', postTransferVerificationSchema);
