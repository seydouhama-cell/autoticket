const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  feeAmount: { type: Number, default: 0 },
  commissionAmount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  phone: { type: String, required: true },
  method: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  transactionId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);