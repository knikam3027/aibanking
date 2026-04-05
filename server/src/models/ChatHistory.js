const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'ai'], required: true },
  message: { type: String, required: true },
}, { timestamps: true });

// Index for efficient queries
chatHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
