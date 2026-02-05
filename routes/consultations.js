const express = require('express');
const router = express.Router();

// Create consultation request
router.post('/', async (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const Consultation = require('../models/Consultation');
    
    const { company, contact, email, phone, requirements } = req.body;
    
    // Input validation
    if (!company || !contact || !email || !phone || !requirements) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    const consultationId = uuidv4();
    
    const consultation = new Consultation({
      consultationId,
      company,
      contact,
      email: email.toLowerCase(),
      phone: phone.replace(/\D/g, ''),
      requirements
    });
    
    const savedConsultation = await consultation.save();
    
    res.status(201).json({
      message: 'Consultation request submitted successfully',
      consultation: savedConsultation
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all consultations (admin)
router.get('/', async (req, res) => {
  try {
    const Consultation = require('../models/Consultation');
    
    const { status } = req.query;
    const filter = status ? { status } : {};
    
    const consultations = await Consultation.find(filter)
      .sort({ createdAt: -1 });
    
    res.json(consultations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update consultation status
router.patch('/:id/status', async (req, res) => {
  try {
    const Consultation = require('../models/Consultation');
    
    const { status } = req.body;
    
    if (!['pending', 'completed', 'checkedIn'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const updateData = { status };
    if (status === 'checkedIn') {
      updateData.checkedAt = new Date();
    }
    
    const consultation = await Consultation.findOneAndUpdate(
      { consultationId: req.params.id },
      updateData,
      { new: true }
    );
    
    if (!consultation) {
      return res.status(404).json({ message: 'Consultation not found' });
    }
    
    res.json(consultation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search consultations by email
router.get('/search', async (req, res) => {
  try {
    const Consultation = require('../models/Consultation');
    
    const email = req.query.email?.toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ message: 'Email parameter required' });
    }
    
    const consultations = await Consultation.find({ 
      email: { $regex: email, $options: 'i' }
    }).sort({ createdAt: -1 });
    
    res.json(consultations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;