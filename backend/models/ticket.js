const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, default: '' },
  code: { type: String, required: true, unique: true },
  etat: { type: String, enum: ['disponible', 'vendu', 'expire'], default: 'disponible' },
  source: { type: String, enum: ['api', 'import'], default: 'import' },
  dateVente: { type: Date },
  clientPhone: { type: String },
  usedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);