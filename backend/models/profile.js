const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  nom: { type: String, required: true },
  uptime: { type: String, required: true },
  prix: { type: Number, required: true },
  sharedUsers: { type: Number, default: 1 },
  bandwidthUp: { type: Number, default: 0 },
  bandwidthDown: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Profile', ProfileSchema);