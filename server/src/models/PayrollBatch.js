const mongoose = require('mongoose');

const employeePaymentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifsc: { type: String, default: '' },
  salary: { type: Number, required: true },
  bank: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'verified', 'verification_failed', 'paid', 'payment_failed'], default: 'pending' },
  verified: { type: Boolean, default: false },
  verificationNote: { type: String, default: '' },
  utr: { type: String, default: '' },
  paidAt: { type: Date },
});

const payrollBatchSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  employees: [employeePaymentSchema],
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['parsed', 'verifying', 'verified', 'review', 'confirmed', 'processing', 'completed', 'failed'], default: 'parsed' },
  paidCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
}, { timestamps: true });

payrollBatchSchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model('PayrollBatch', payrollBatchSchema);
