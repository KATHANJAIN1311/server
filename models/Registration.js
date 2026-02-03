// models/Registration.js
// models/Registration.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const registrationSchema = new mongoose.Schema({
  registrationId: { 
    type: String, 
    unique: true,
    default: () => uuidv4().substring(0, 8).toUpperCase()
  },
  eventId: { type: String, required: true, ref: 'Event' },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  qrCode: { type: String, required: true },
  registrationType: { type: String, enum: ['online', 'kiosk'], default: 'online' },
  ticketTier: { type: String, default: '' },
  ticketPrice: { type: Number, default: 0 },
  organization: { type: String, default: '' },
  designation: { type: String, default: '' },
  isCheckedIn: { type: Boolean, default: false },
  checkedInAt: { type: Date }
}, {
  timestamps: true
});

const Registration = mongoose.model('Registration', registrationSchema);

module.exports = Registration;
