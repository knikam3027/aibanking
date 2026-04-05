const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  financialHealthScore: { type: Number },
  monthlySummary: { type: String },
  prediction: { type: String },
  spendingBreakdown: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('AiInsight', aiInsightSchema);
