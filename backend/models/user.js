const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  balance: { type: Number, default: 0 },
  hotspotName: { type: String },
  gpsEnabled: { type: Boolean, default: false },
  gpsLat: { type: Number },
  gpsLng: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);