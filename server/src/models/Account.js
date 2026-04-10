const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountNumber: { type: String, required: true, unique: true },
  balance: { type: Number, default: 10000 },
  accountType: { type: String, enum: ['savings', 'current'], default: 'savings' },
  isHeld: { type: Boolean, default: false },
  heldAt: { type: Date },
  heldReason: { type: String },
  heldByVerificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'PostTransferVerification' },
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
