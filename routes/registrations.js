const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

/* =====================================================
   HELPER FUNCTION: Generate unique registration ID
===================================================== */
const generateRegistrationId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/* =====================================================
   CREATE NEW REGISTRATION
===================================================== */
router.post('/', async (req, res) => {
  try {
    console.log('📝 Creating new registration:', req.body);

    const { eventId, name, email, phone, company, ticketTier, numberOfTickets } = req.body;

    // Validate required fields
    if (!eventId || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: eventId, name, email, phone'
      });
    }

    // Check if event exists
    const event = await Event.findOne({ eventId, isActive: true });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or inactive'
      });
    }

    // Check if already registered
    const existingRegistration = await Registration.findOne({ 
      eventId, 
      email 
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered for this event',
        registrationId: existingRegistration.registrationId
      });
    }

    // Check capacity
    const currentRegistrations = await Registration.countDocuments({ eventId });
    
    if (currentRegistrations >= event.maxCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Event is at full capacity'
      });
    }

    // Check ticket tier availability
    if (ticketTier && event.ticketTiers && event.ticketTiers.length > 0) {
      const tier = event.ticketTiers.find(t => t.name.toLowerCase() === ticketTier.toLowerCase());
      
      if (tier) {
        const tierBookings = await Registration.countDocuments({ 
          eventId, 
          ticketTier: ticketTier.toLowerCase() 
        });
        
        if (tierBookings >= tier.seats) {
          return res.status(400).json({
            success: false,
            message: `${ticketTier} tier is fully booked`
          });
        }
      }
    }

    // Generate registration ID
    let registrationId;
    let isUnique = false;
    
    while (!isUnique) {
      registrationId = generateRegistrationId();
      const existing = await Registration.findOne({ registrationId });
      if (!existing) isUnique = true;
    }

    // Calculate total amount
    let totalAmount = 0;
    if (ticketTier && event.ticketTiers && event.ticketTiers.length > 0) {
      const tier = event.ticketTiers.find(t => t.name.toLowerCase() === ticketTier.toLowerCase());
      if (tier) {
        totalAmount = tier.price * (numberOfTickets || 1);
      }
    }

    // Generate QR code
    const qrCodeData = JSON.stringify({
      registrationId,
      eventId,
      name,
      email
    });

    const qrCode = await QRCode.toDataURL(qrCodeData);

    // Create registration
    const registration = new Registration({
      registrationId,
      eventId,
      name,
      email,
      phone,
      company: company || '',
      ticketTier: ticketTier ? ticketTier.toLowerCase() : 'silver',
      numberOfTickets: numberOfTickets || 1,
      totalAmount,
      qrCode,
      status: 'confirmed',
      paymentStatus: totalAmount > 0 ? 'pending' : 'completed'
    });

    await registration.save();

    console.log('✅ Registration created:', registrationId);

    // Emit socket event if available
    if (req.io) {
      req.io.emit('newRegistration', {
        eventId,
        registrationId,
        name
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: registration
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating registration',
      error: error.message
    });
  }
});

/* =====================================================
   GET REGISTRATION BY ID
===================================================== */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Fetching registration:', id);

    const registration = await Registration.findOne({ registrationId: id });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Get event details
    const event = await Event.findOne({ eventId: registration.eventId });

    return res.json({
      success: true,
      data: {
        ...registration.toObject(),
        event: event ? {
          name: event.name,
          date: event.date,
          time: event.time,
          venue: event.venue
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Error fetching registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching registration'
    });
  }
});

/* =====================================================
   GET REGISTRATIONS BY EVENT
===================================================== */
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('📋 Fetching registrations for event:', eventId);

    const registrations = await Registration
      .find({ eventId })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: registrations,
      count: registrations.length
    });

  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching registrations'
    });
  }
});

/* =====================================================
   SEARCH REGISTRATIONS BY EMAIL
===================================================== */
router.get('/search', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required'
      });
    }

    console.log('🔍 Searching registrations for:', email);

    const registrations = await Registration.find({ 
      email: { $regex: email, $options: 'i' } 
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: registrations,
      count: registrations.length
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching registrations'
    });
  }
});

/* =====================================================
   UPDATE REGISTRATION STATUS (CHECK-IN)
===================================================== */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('📝 Updating registration status:', id, status);

    // Validate registration ID format
    if (!id || typeof id !== 'string' || !/^[A-Z0-9]{8}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    const registration = await Registration.findOne({ registrationId: id });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Update status
    if (status === 'checkedIn') {
      registration.isCheckedIn = true;
      registration.checkedInAt = new Date();
      registration.status = 'checkedIn';
    } else {
      registration.status = status;
    }

    await registration.save();

    console.log('✅ Registration updated:', id);

    // Emit socket event
    if (req.io) {
      req.io.emit('registrationUpdate', {
        eventId: registration.eventId,
        registrationId: id,
        status
      });
    }

    return res.json({
      success: true,
      message: 'Registration updated successfully',
      data: registration
    });

  } catch (error) {
    console.error('❌ Update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating registration'
    });
  }
});

/* =====================================================
   DELETE REGISTRATION
===================================================== */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting registration:', id);

    const registration = await Registration.findOneAndDelete({ registrationId: id });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    console.log('✅ Registration deleted:', id);

    return res.json({
      success: true,
      message: 'Registration deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting registration'
    });
  }
});

module.exports = router;