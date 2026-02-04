const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Event = require('../models/Event');
const Registration = require('../models/Registration');

/* =====================================================
   AUTHENTICATION MIDDLEWARE
===================================================== */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

/* =====================================================
   ADMIN LOGIN - NOTE: Also handled in index.js
   This route is here as backup
===================================================== */
router.post('/login', async (req, res) => {
  try {
    console.log('📝 Admin login attempt:', req.body.username);
    
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find admin in database
    const admin = await Admin.findOne({ username });
    
    if (!admin) {
      console.log('❌ Admin not found:', username);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', username);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role || 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful:', username);

    return res.json({
      success: true,
      token: token,
      user: { 
        id: admin._id,
        username: admin.username, 
        role: admin.role || 'admin' 
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

/* =====================================================
   GET DASHBOARD DATA
===================================================== */
router.get('/dashboard/:eventId', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('📊 Fetching dashboard for event:', eventId);

    // Get event details
    const event = await Event.findOne({ eventId });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Get registration statistics
    const totalRegistrations = await Registration.countDocuments({ eventId });
    const checkedIn = await Registration.countDocuments({ eventId, isCheckedIn: true });
    const pending = await Registration.countDocuments({ eventId, status: 'pending' });
    const confirmed = await Registration.countDocuments({ eventId, status: 'confirmed' });

    // Get registrations by ticket tier
    const silverCount = await Registration.countDocuments({ eventId, ticketTier: 'silver' });
    const goldCount = await Registration.countDocuments({ eventId, ticketTier: 'gold' });
    const platinumCount = await Registration.countDocuments({ eventId, ticketTier: 'platinum' });

    // Get recent registrations
    const recentRegistrations = await Registration
      .find({ eventId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email phone ticketTier status isCheckedIn createdAt');

    return res.json({
      success: true,
      data: {
        event: event.toObject(),
        statistics: {
          totalRegistrations,
          checkedIn,
          pending,
          confirmed,
          notCheckedIn: totalRegistrations - checkedIn,
          checkInRate: totalRegistrations > 0 ? ((checkedIn / totalRegistrations) * 100).toFixed(2) : 0
        },
        ticketTiers: {
          silver: silverCount,
          gold: goldCount,
          platinum: platinumCount
        },
        recentRegistrations
      }
    });

  } catch (error) {
    console.error('❌ Dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
});

/* =====================================================
   EXPORT REGISTRATIONS
===================================================== */
router.get('/export/registrations/:eventId', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('📥 Exporting registrations for event:', eventId);

    const event = await Event.findOne({ eventId });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const registrations = await Registration
      .find({ eventId })
      .sort({ createdAt: -1 })
      .select('registrationId name email phone company ticketTier numberOfTickets totalAmount status isCheckedIn checkedInAt createdAt');

    return res.json({
      success: true,
      eventName: event.name,
      data: registrations
    });

  } catch (error) {
    console.error('❌ Export error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error exporting registrations'
    });
  }
});

/* =====================================================
   EXPORT CHECK-INS
===================================================== */
router.get('/export/checkins/:eventId', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('📥 Exporting check-ins for event:', eventId);

    const event = await Event.findOne({ eventId });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const checkins = await Registration
      .find({ eventId, isCheckedIn: true })
      .sort({ checkedInAt: -1 })
      .select('registrationId name email phone ticketTier checkedInAt');

    return res.json({
      success: true,
      eventName: event.name,
      data: checkins
    });

  } catch (error) {
    console.error('❌ Export error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error exporting check-ins'
    });
  }
});

/* =====================================================
   TEST ROUTE
===================================================== */
router.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Admin routes are accessible!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;