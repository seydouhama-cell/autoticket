const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: String, required: true },
  profileName: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Product', ProductSchema);