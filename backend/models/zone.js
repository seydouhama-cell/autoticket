const mongoose = require('mongoose');

const ZoneSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nom: { type: String, required: true },
  ip: { type: String, required: true },
  port: { type: Number, default: 8728 },
  username: { type: String, required: true },
  passwordEncrypt: { type: String, required: true },
  ssl: { type: Boolean, default: false },
  serverHotspot: { type: String, default: 'hotspot' },
  mode: { type: String, enum: ['api', 'import'], default: 'api' },
  status: { type: String, enum: ['active', 'inactive', 'error'], default: 'active' },
  location: { type: String, default: '' },
  ssid: { type: String, default: '' },
  gps: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  config: {
    dns: { type: String, default: '' },
    portalUrl: { type: String, default: '' },
    ticketFormat: { type: String, enum: ['code', 'userpass', 'both'], default: 'code' },
    walledGarden: { type: Boolean, default: true },
    maxUsers: { type: Number, default: 100 },
    sessionTimeout: { type: Number, default: 3600 }
  },
  isPublished: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Zone', ZoneSchema);