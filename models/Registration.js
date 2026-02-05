const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  registrationId: {
    type: String,
    required: true,
    unique: true
  },
  eventId: {
    type: String,
    required: true,
    ref: 'Event'
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  company: {
    type: String,
    default: ''
  },
  ticketTier: {
    type: String,
    enum: ['silver', 'gold', 'platinum'],
    default: 'silver'
  },
  numberOfTickets: {
    type: Number,
    default: 1
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'checkedIn'],
    default: 'pending'
  },
  isCheckedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date
  },
  qrCode: {
    type: String
  },
  paymentId: {
    type: String
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for faster queries
registrationSchema.index({ eventId: 1, email: 1 });
registrationSchema.index({ registrationId: 1 });

module.exports = mongoose.model('Registration', registrationSchema);