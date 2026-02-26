const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  feedbackId: {
    type: String,
    required: true,
    unique: true
  },
  eventId: {
    type: String,
    required: true,
    ref: 'Event'
  },
  registrationId: {
    type: String,
    ref: 'Registration'
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

feedbackSchema.index({ eventId: 1, email: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
