const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountNumber: { type: String, required: true, unique: true },
  balance: { type: Number, default: 10000 },
  accountType: { type: String, enum: ['savings', 'current'], default: 'savings' },
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
