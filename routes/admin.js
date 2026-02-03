const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const csurf = require('csurf');
const Admin = require('../models/Admin');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Checkin = require('../models/Checkin');

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: "none",
    secure: true
  }
});
const validateLoginInput = (req, res, next) => {
  const { username, password } = req.body;
  
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Invalid input' });
  }
  
  if (username.length > 50 || password.length > 100) {
    return res.status(400).json({ message: 'Input too long' });
  }
  
  next();
};


// Admin login
router.post('/login', csrfProtection, validateLoginInput, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Create default admin if it doesn't exist
    let admin = await Admin.findOne({ username });
    if (!admin && username === 'admin') {
    admin = new Admin({ 
  username: process.env.ADMIN_USERNAME || 'admin', 
  password: process.env.ADMIN_PASSWORD || 'defaultPassword123' 
});
      await admin.save();
    }
    
    // Check credentials
    if (!admin || admin.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    const token = jwt.sign(
      { username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, admin: { username: admin.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Auth middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};


// Get dashboard statistics
router.get('/dashboard/:eventId', authenticateAdmin, csrfProtection, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const totalRegistrations = await Registration.countDocuments({ eventId });
    const totalCheckins = await Registration.countDocuments({ eventId, isCheckedIn: true });
    const onlineRegistrations = await Registration.countDocuments({ eventId, registrationType: 'online' });
    const kioskRegistrations = await Registration.countDocuments({ eventId, registrationType: 'kiosk' });
    
    // Recent registrations
    const recentRegistrations = await Registration.find({ eventId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Recent check-ins
    const recentCheckins = await Checkin.find({ eventId })
      .sort({ checkinTime: -1 })
      .limit(10);
    
    const recentCheckinsWithDetails = await Promise.all(
      recentCheckins.map(async (checkin) => {
        const registration = await Registration.findOne({ registrationId: checkin.registrationId });
        return {
          ...checkin.toObject(),
          registration
        };
      })
    );
    
    // Hourly check-in data for charts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const hourlyCheckins = await Checkin.aggregate([
      {
        $match: {
          eventId,
          checkinTime: { $gte: today }
        }
      },
      {
        $group: {
          _id: { $hour: '$checkinTime' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);
    
    res.json({
      event,
      statistics: {
        totalRegistrations,
        totalCheckins,
        onlineRegistrations,
        kioskRegistrations,
        attendanceRate: totalRegistrations > 0 ? ((totalCheckins / totalRegistrations) * 100).toFixed(1) : 0
      },
      recentRegistrations,
      recentCheckins: recentCheckinsWithDetails,
      hourlyCheckins
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export registrations data
router.get('/export/registrations/:eventId', authenticateAdmin, csrfProtection, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const registrations = await Registration.find({ eventId });
    const event = await Event.findOne({ eventId });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const csvData = registrations.map(reg => ({
      'Registration ID': reg.registrationId,
      'Name': reg.name,
      'Email': reg.email,
      'Phone': reg.phone,
      'Registration Type': reg.registrationType,
      'Checked In': reg.isCheckedIn ? 'Yes' : 'No',
      'Registration Date': reg.createdAt.toISOString()
    }));
    
    res.json({
      eventName: event.name,
      data: csvData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export check-ins data
router.get('/export/checkins/:eventId', authenticateAdmin, csrfProtection, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const checkins = await Checkin.find({ eventId });
    const event = await Event.findOne({ eventId });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const csvData = await Promise.all(
      checkins.map(async (checkin) => {
        const registration = await Registration.findOne({ registrationId: checkin.registrationId });
        return {
          'Check-in ID': checkin.checkinId,
          'Registration ID': checkin.registrationId,
          'Name': registration?.name || 'N/A',
          'Email': registration?.email || 'N/A',
          'Phone': registration?.phone || 'N/A',
          'Check-in Time': checkin.checkinTime.toISOString(),
          'Checked In By': checkin.checkedInBy
        };
      })
    );
    
    res.json({
      eventName: event.name,
      data: csvData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;