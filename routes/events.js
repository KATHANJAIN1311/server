const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Event = require('../models/Event');
const Registration = require('../models/Registration');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/* =====================================================
   CRITICAL: Handle CORS for all routes
===================================================== */
router.use((req, res, next) => {
  // Set CORS headers explicitly for events route
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://creativeeraevents.in',
    'https://www.creativeeraevents.in',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.header('Access-Control-Allow-Origin', origin); // Allow anyway
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-CSRF-Token');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

/* =====================================================
   GET ALL EVENTS
===================================================== */
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching all events...');
    
    const events = await Event.find({ isActive: true }).sort({ date: 1 });
    
    console.log(`✅ Found ${events.length} events`);
    
    // Add registration counts to each event
    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const registrationCount = await Registration.countDocuments({ 
          eventId: event.eventId 
        });
        const checkedInCount = await Registration.countDocuments({ 
          eventId: event.eventId, 
          isCheckedIn: true 
        });
        
        return {
          ...event.toObject(),
          registrationCount,
          checkedInCount
        };
      })
    );
    
    // Return in the format expected by frontend
    return res.status(200).json({
      success: true,
      data: eventsWithCounts,
      count: eventsWithCounts.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching events',
      error: error.message
    });
  }
});

/* =====================================================
   GET EVENT BY ID
===================================================== */
router.get('/:id', async (req, res) => {
  try {
    console.log('🔍 Fetching event:', req.params.id);
    
    const event = await Event.findOne({ eventId: req.params.id });
    
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    const registrationCount = await Registration.countDocuments({ 
      eventId: req.params.id 
    });
    const checkedInCount = await Registration.countDocuments({ 
      eventId: req.params.id, 
      isCheckedIn: true 
    });
    
    // Get booked seats by tier
    const silverBooked = await Registration.countDocuments({ 
      eventId: req.params.id, 
      ticketTier: 'silver' 
    });
    const platinumBooked = await Registration.countDocuments({ 
      eventId: req.params.id, 
      ticketTier: 'platinum' 
    });
    const goldBooked = await Registration.countDocuments({ 
      eventId: req.params.id, 
      ticketTier: 'gold' 
    });
    
    return res.json({
      success: true,
      data: {
        ...event.toObject(),
        registrationCount,
        checkedInCount,
        silverBooked,
        platinumBooked,
        goldBooked
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching event:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/* =====================================================
   CREATE NEW EVENT
===================================================== */
router.post('/', (req, res) => {
  const contentType = req.headers['content-type'];
  
  if (contentType && contentType.includes('multipart/form-data')) {
    // Handle file upload
    upload.single('image')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err.message);
        return res.status(400).json({ 
          success: false,
          message: err.message 
        });
      }
      
      console.log('📁 File uploaded:', req.file);
      
      try {
        const eventId = uuidv4();
        const eventData = {
          eventId,
          ...req.body
        };
        
        // Parse ticketTiers if it's a string
        if (typeof eventData.ticketTiers === 'string') {
          try {
            eventData.ticketTiers = JSON.parse(eventData.ticketTiers);
          } catch (parseError) {
            eventData.ticketTiers = [];
          }
        }
        
        if (req.file) {
          eventData.imageUrl = `/uploads/${req.file.filename}`;
        }
        
        // Validate required fields
        if (!eventData.name || !eventData.date || !eventData.time || !eventData.venue || !eventData.description) {
          return res.status(400).json({ 
            success: false,
            message: 'Missing required fields: name, date, time, venue, description' 
          });
        }
        
        const event = new Event(eventData);
        const savedEvent = await event.save();
        
        console.log('✅ Event created:', savedEvent.eventId);
        
        return res.status(201).json({
          success: true,
          data: savedEvent,
          message: 'Event created successfully'
        });
        
      } catch (error) {
        console.error('❌ Event creation error:', error);
        return res.status(400).json({ 
          success: false,
          message: error.message 
        });
      }
    });
  } else {
    // Handle regular JSON data
    (async () => {
      try {
        const eventId = uuidv4();
        const eventData = {
          eventId,
          ...req.body
        };
        
        // Validate required fields
        if (!eventData.name || !eventData.date || !eventData.time || !eventData.venue || !eventData.description) {
          return res.status(400).json({ 
            success: false,
            message: 'Missing required fields: name, date, time, venue, description' 
          });
        }
        
        const event = new Event(eventData);
        const savedEvent = await event.save();
        
        console.log('✅ Event created:', savedEvent.eventId);
        
        return res.status(201).json({
          success: true,
          data: savedEvent,
          message: 'Event created successfully'
        });
        
      } catch (error) {
        console.error('❌ Event creation error:', error);
        return res.status(400).json({ 
          success: false,
          message: error.message 
        });
      }
    })();
  }
});

/* =====================================================
   UPDATE EVENT
===================================================== */
router.put('/:id', async (req, res) => {
  try {
    console.log('📝 Updating event:', req.params.id);
    
    const event = await Event.findOneAndUpdate(
      { eventId: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    console.log('✅ Event updated:', event.eventId);
    
    return res.json({
      success: true,
      data: event,
      message: 'Event updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating event:', error);
    return res.status(400).json({ 
      success: false,
      message: error.message 
    });
  }
});

/* =====================================================
   DELETE EVENT (SOFT DELETE)
===================================================== */
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting event:', req.params.id);
    
    const event = await Event.findOneAndUpdate(
      { eventId: req.params.id },
      { isActive: false },
      { new: true }
    );
    
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found' 
      });
    }
    
    console.log('✅ Event deleted:', event.eventId);
    
    return res.json({ 
      success: true,
      message: 'Event deleted successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

module.exports = router;