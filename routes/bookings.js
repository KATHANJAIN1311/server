const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const Event = require('../models/Event');

// Create booking (alias for registration with validation)
router.post('/', async (req, res) => {
  try {
    const { eventId, ticketTier } = req.body;
    
    // Validate event exists
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Validate ticket tier
    if (!['silver', 'platinum', 'gold'].includes(ticketTier)) {
      return res.status(400).json({ message: 'Invalid ticket tier' });
    }
    
    // Check seat availability
    const bookedCount = await Registration.countDocuments({ eventId, ticketTier });
    const availableSeats = event[`${ticketTier}Seats`] || 0;
    const ticketPrice = event[`${ticketTier}Price`] || 0;
    
    if (bookedCount >= availableSeats) {
      return res.status(400).json({ message: `No seats available for ${ticketTier} tier` });
    }
    
    // Return booking validation success
    res.json({
      success: true,
      eventId,
      ticketTier,
      ticketPrice,
      availableSeats: availableSeats - bookedCount,
      message: 'Booking validated successfully'
    });
    
  } catch (error) {
    console.error('Booking validation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;