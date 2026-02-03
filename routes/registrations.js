const express = require('express');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { generateRegistrationConfirmationEmail } = require('../utils/emailTemplate');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // CSRF Protection - Validate request origin (more robust)
    const originHeader = req.get('Origin') || req.get('Referer') || '';
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'https://creativeeraevents.in',
      'https://www.creativeeraevents.in',
      'http://localhost:3005',
      'http://127.0.0.1:3005',
      'http://localhost:3000'
    ].filter(Boolean);

    const normalizedOrigin = originHeader.replace(/\/$/, '');

    const isAllowed = allowedOrigins.some((allowed) => {
      try {
        const normAllowed = allowed.replace(/\/$/, '');
        return (normalizedOrigin === normAllowed) || normalizedOrigin.startsWith(normAllowed);
      } catch (e) {
        return false;
      }
    });

    if (normalizedOrigin && !isAllowed) {
      return res.status(403).json({ message: 'Forbidden: Invalid origin' });
    }

    const { name, email, phone, eventId, registrationType, organization, designation, ticketTier, ticketPrice } = req.body;
    
    // Validate ticket tier and pricing
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Validate ticket tier and price
    if (ticketTier) {
      const tier = event.ticketTiers.find(t => t.name.toLowerCase() === ticketTier.toLowerCase());
      if (!tier) {
        return res.status(400).json({ message: 'Invalid ticket tier' });
      }
      
      if (ticketPrice !== tier.price) {
        return res.status(400).json({ message: 'Invalid ticket price' });
      }
      
      // Check seat availability
      const bookedCount = await Registration.countDocuments({ eventId, ticketTier });
      
      if (bookedCount >= tier.seats) {
        return res.status(400).json({ message: `No seats available for ${tier.name} tier` });
      }
    }
    
    // Input sanitization to prevent XSS
    const sanitizedName = name ? name.replace(/[<>]/g, '') : '';
    const sanitizedEmail = email ? email.replace(/[<>]/g, '') : '';
    const sanitizedPhone = phone ? phone.replace(/[<>]/g, '') : '';
    const sanitizedOrganization = organization ? organization.replace(/[<>]/g, '') : '';
    const sanitizedDesignation = designation ? designation.replace(/[<>]/g, '') : '';
    
    // Generate unique registration ID
    const registrationId = uuidv4().substring(0, 8).toUpperCase();
    
    // Create QR code data
    const qrData = {
      registrationId,
      eventId,
      name: sanitizedName,
      email: sanitizedEmail,
      timestamp: new Date().toISOString()
    };
    
    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));
    
    const registrationData = {
      registrationId,
      eventId,
      name: sanitizedName,
      email: sanitizedEmail,
      phoneNumber: sanitizedPhone,
      qrCode: qrCodeDataURL,
      registrationType: registrationType || 'online',
      organization: sanitizedOrganization,
      designation: sanitizedDesignation,
      ticketTier: ticketTier || (event.ticketTiers.length > 0 ? event.ticketTiers[0].name : 'general'),
      ticketPrice: ticketPrice || 0
    };
    
    const registration = new Registration(registrationData);
    await registration.save();
    
    // Emit real-time update
    if (req.io) {
      req.io.emit('newRegistration', { eventId, registration: registrationData });
    }
    
    // Send professional confirmation email
    try {
      // Fetch event details for email
      const eventDetails = await Event.findOne({ eventId });
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: true
        }
      });

      // Convert data URL to buffer for attachment
      const qrCodeBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');

      const emailHtml = generateRegistrationConfirmationEmail(
        registrationData,
        eventDetails,
        'cid:qrcode' // Use CID reference instead of data URL
      );

      const mailOptions = {
        from: `"Creative Era Events" <${process.env.EMAIL_USER}>`,
        to: sanitizedEmail,
        subject: `🎉 Registration Confirmed - Welcome to ${eventDetails?.name || 'Our Event'}!`,
        html: emailHtml,
        attachments: [{
          filename: `qr-code-${registrationId}.png`,
          content: qrCodeBuffer,
          cid: 'qrcode' // Content-ID for inline embedding
        }]
      };

      await transporter.sendMail(mailOptions);
      console.log('Professional confirmation email sent to:', sanitizedEmail);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the registration if email fails
    }
    
    res.status(201).json({
      message: 'Registration created successfully!',
      registration: {
        ...registrationData,
        phone: sanitizedPhone // Add phone field for compatibility
      },
      qrCode: qrCodeDataURL
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(400).json({ 
      error: err.message || 'Error creating registration' 
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    console.error("REGISTRATION FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/event/:eventId', async (req, res) => {
  try {
    const registrations = await Registration.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    console.error("REGISTRATION FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/user/:email', async (req, res) => {
  try {
    const registrations = await Registration.find({ email: req.params.email }).sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    console.error("REGISTRATION FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { email } = req.query;
    const registrations = await Registration.find({ email }).sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    console.error("REGISTRATION FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:registrationId', async (req, res) => {
  try {
    const registration = await Registration.findOne({ registrationId: req.params.registrationId });
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    res.json(registration);
  } catch (err) {
    console.error("REGISTRATION FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
