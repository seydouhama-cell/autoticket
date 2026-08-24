const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  subscriptionStartDate: { type: Date, default: Date.now },
  subscriptionEndDate: { type: Date, required: true },
  plan: { type: String, enum: ['monthly', 'quarterly', 'semester', 'yearly'], default: 'monthly' },
  paymentMethod: { type: String },
  lastPaymentDate: { type: Date },
  amountPaid: { type: Number, default: 0 },
  autoRenew: { type: Boolean, default: false }
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);