const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  consultationId: {
    type: String,
    required: true,
    unique: true
  },
  company: {
    type: String,
    required: true
  },
  contact: {
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
  requirements: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'checkedIn'],
    default: 'pending'
  },
  checkedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Consultation', consultationSchema);