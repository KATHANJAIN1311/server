const mongoose = require('mongoose');

const checkinSchema = new mongoose.Schema({
  checkinId: {
    type: String,
    required: true,
    unique: true
  },
  registrationId: {
    type: String,
    required: true,
    ref: 'Registration'
  },
  eventId: {
    type: String,
    required: true,
    ref: 'Event'
  },
  checkinTime: {
    type: Date,
    default: Date.now
  },
  checkedInBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Checkin', checkinSchema);