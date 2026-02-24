const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { generateRegistrationConfirmationEmail } = require('../utils/emailTemplate');

/* =====================================================
   HELPER FUNCTIONS
===================================================== */
const generateRegistrationId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const generateBookingPassword = () => {
  const length = Math.floor(Math.random() * 3) + 4; // 4-6 digits
  return String(Math.floor(Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1))) + Math.pow(10, length - 1));
};

// Email transporter setup
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
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

    // Generate QR code in format: registrationId|eventId
    const qrCodeData = `${registrationId}|${eventId}`;

    const qrCode = await QRCode.toDataURL(qrCodeData);

    // Generate booking password
    const bookingPassword = generateBookingPassword();

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
      bookingPassword,
      status: 'confirmed',
      paymentStatus: totalAmount > 0 ? 'pending' : 'completed'
    });

    await registration.save();

    console.log('✅ Registration created:', registrationId);

    // Send confirmation email with booking password
    try {
      console.log('📧 Preparing to send confirmation email to:', email);
      const transporter = createEmailTransporter();
      
      // Verify transporter
      await transporter.verify();
      console.log('✅ Email transporter verified');
      
      const emailHtml = generateRegistrationConfirmationEmail(
        {
          registrationId,
          name,
          email,
          phoneNumber: phone,
          organization: company,
          bookingPassword
        },
        {
          name: event.name,
          date: event.date,
          time: event.time,
          venue: event.venue
        },
        qrCode
      );

      const mailOptions = {
        from: `"Creative Era Events" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Registration Confirmed - ${event.name} | Booking Password: ${bookingPassword}`,
        html: emailHtml
      };
      
      console.log('📤 Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const info = await transporter.sendMail(mailOptions);

      console.log('✅ Confirmation email sent successfully!');
      console.log('📧 Message ID:', info.messageId);
      console.log('📬 Response:', info.response);
      
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError.message);
      console.error('🔍 Email error details:', emailError);
      
      if (emailError.code === 'EAUTH') {
        console.error('🚨 Email authentication failed - check Gmail app password');
      } else if (emailError.code === 'ENOTFOUND') {
        console.error('🚨 Network error - check internet connection');
      }
      
      // Don't fail the registration if email fails
    }

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
   GET ALL REGISTRATIONS
===================================================== */
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching all registrations');
    const registrations = await Registration.find().sort({ createdAt: -1 });
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
   GET USER BOOKINGS WITH PASSWORD VALIDATION
===================================================== */
router.post('/my-bookings', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and booking password are required'
      });
    }

    console.log('🔐 Validating booking access for:', email);

    // Find registrations by email and password
    const registrations = await Registration.find({ 
      email: email.toLowerCase().trim(),
      bookingPassword: password.trim()
    }).sort({ createdAt: -1 });

    if (!registrations || registrations.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or booking password'
      });
    }

    // Get event details for each registration
    const bookingsWithEvents = await Promise.all(
      registrations.map(async (reg) => {
        const event = await Event.findOne({ eventId: reg.eventId });
        return {
          ...reg.toObject(),
          event: event ? {
            name: event.name,
            date: event.date,
            time: event.time,
            venue: event.venue,
            imageUrl: event.imageUrl,
            description: event.description
          } : null
        };
      })
    );

    console.log('✅ Booking access granted for:', email);

    return res.json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: bookingsWithEvents,
      count: bookingsWithEvents.length
    });

  } catch (error) {
    console.error('❌ My bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving bookings'
    });
  }
});

/* =====================================================
   GET REGISTRATIONS BY USER EMAIL (Legacy)
===================================================== */
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('📋 Fetching registrations for user:', email);

    const registrations = await Registration
      .find({ email: email.toLowerCase() })
      .sort({ createdAt: -1 });

    // Get event details for each registration
    const registrationsWithEvents = await Promise.all(
      registrations.map(async (reg) => {
        const event = await Event.findOne({ eventId: reg.eventId });
        return {
          ...reg.toObject(),
          event: event ? {
            name: event.name,
            date: event.date,
            time: event.time,
            venue: event.venue
          } : null
        };
      })
    );

    return res.json({
      success: true,
      data: registrationsWithEvents,
      count: registrationsWithEvents.length
    });

  } catch (error) {
    console.error('❌ Error fetching user registrations:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching registrations'
    });
  }
});
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
   UPDATE REGISTRATION STATUS (CHECK-IN) - ENHANCED
===================================================== */
// Enhanced CORS for status endpoint
router.options('/:id/status', (req, res) => {
  console.log('🔧 CORS preflight for status update:', req.params.id);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('📝 PATCH request received for registration:', id, 'status:', status);
    console.log('🌐 Request origin:', req.headers.origin);
    console.log('📋 Request headers:', req.headers);

    // Enhanced CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Validate registration ID format
    if (!id || typeof id !== 'string' || !/^[A-Z0-9]{8}$/.test(id)) {
      console.log('❌ Invalid registration ID format:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    const registration = await Registration.findOne({ registrationId: id });

    if (!registration) {
      console.log('❌ Registration not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    console.log('✅ Registration found:', registration.name, registration.email);

    // Update status
    if (status === 'checkedIn') {
      registration.isCheckedIn = true;
      registration.checkedInAt = new Date();
      registration.status = 'checkedIn';
      console.log('✅ Setting check-in status');
    } else {
      registration.status = status;
      console.log('✅ Setting status to:', status);
    }

    await registration.save();

    console.log('✅ Registration updated successfully:', id);

    // Emit socket event
    if (req.io) {
      req.io.emit('registrationUpdate', {
        eventId: registration.eventId,
        registrationId: id,
        status
      });
      console.log('📡 Socket event emitted');
    }

    return res.json({
      success: true,
      message: 'Registration updated successfully',
      data: registration
    });

  } catch (error) {
    console.error('❌ PATCH Update error:', error);
    console.error('🔍 Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error updating registration',
      error: error.message
    });
  }
});

// PUT route as fallback for PATCH
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('📝 PUT request for registration status:', id, status);

    // Enhanced CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

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

    console.log('✅ Registration updated (PUT):', id);

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
    console.error('❌ PUT Update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating registration'
    });
  }
});

/* =====================================================
   SIMPLE CHECK-IN ENDPOINT (POST Alternative)
===================================================== */
router.post('/:id/checkin', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('✅ POST check-in request for:', id);
    console.log('🌐 Request origin:', req.headers.origin);

    // Enhanced CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Validate registration ID format
    if (!id || typeof id !== 'string' || !/^[A-Z0-9]{8}$/.test(id)) {
      console.log('❌ Invalid registration ID format:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    console.log('🔍 Looking for registration:', id);
    const registration = await Registration.findOne({ registrationId: id });

    if (!registration) {
      console.log('❌ Registration not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    console.log('✅ Registration found:', registration.name, registration.email);

    // Check if already checked in
    if (registration.isCheckedIn) {
      console.log('⚠️ User already checked in:', id);
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        message: 'User already checked in',
        data: registration
      });
    }

    // Update to checked in
    registration.isCheckedIn = true;
    registration.checkedInAt = new Date(); // Fixed field name
    registration.status = 'checkedIn';

    console.log('💾 Saving registration updates...');
    await registration.save();

    console.log('✅ Check-in successful:', id);

    // Emit socket event
    if (req.io) {
      req.io.emit('registrationUpdate', {
        eventId: registration.eventId,
        registrationId: id,
        status: 'checkedIn'
      });
      console.log('📡 Socket event emitted');
    }

    return res.json({
      success: true,
      message: 'Check-in successful',
      data: registration
    });

  } catch (error) {
    console.error('❌ Check-in error:', error);
    console.error('🔍 Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error during check-in',
      error: error.message
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