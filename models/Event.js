const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    set: function(value) {
      // Handle string dates from form inputs
      if (typeof value === 'string') {
        return new Date(value);
      }
      return value;
    }
  },
  time: {
    type: String,
    required: true
  },
  venue: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxCapacity: {
    type: Number,
    default: 1000
  },
  ticketTiers: [{
    name: { type: String, required: true },
    price: { type: Number, required: true },
    seats: { type: Number, required: true }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Event', eventSchema);