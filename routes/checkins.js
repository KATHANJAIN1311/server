const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Registration = require('../models/Registration');
const Checkin = require('../models/Checkin');

/**
 * POST /api/checkins/verify
 * Supports:
 * 1) QR check-in → registrationId|eventId
 * 2) Manual admin check-in → registrationId
 */
router.post('/verify', async (req, res) => {
  try {
    const { qrData, registrationId: manualRegistrationId } = req.body;

    let registrationId;
    let eventId;

    /* ---------------- QR MODE ---------------- */
    if (qrData) {
      if (typeof qrData !== 'string' || !qrData.includes('|')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code format'
        });
      }

      const parts = qrData.split('|');
      if (parts.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code data'
        });
      }

      [registrationId, eventId] = parts;
    }

    /* ---------------- MANUAL ADMIN MODE ---------------- */
    if (!qrData && manualRegistrationId) {
      registrationId = manualRegistrationId;

      // Find registration to get eventId
      const reg = await Registration.findOne({ registrationId });
      if (!reg) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }

      eventId = reg.eventId;
    }

    if (!registrationId || !eventId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check-in data'
      });
    }

    /* ---------------- FIND REGISTRATION ---------------- */
    const registration = await Registration.findOne({ registrationId, eventId });
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    /* ---------------- ALREADY CHECKED IN ---------------- */
    if (registration.isCheckedIn) {
      return res.status(200).json({
        success: false,
        alreadyCheckedIn: true,
        message: 'User already checked in',
        registration
      });
    }

    /* ---------------- CREATE CHECKIN ---------------- */
    const checkin = new Checkin({
      checkinId: uuidv4(),
      registrationId,
      eventId
    });

    await checkin.save();

    registration.isCheckedIn = true;
    registration.checkedAt = new Date();
    await registration.save();

    /* ---------------- REALTIME UPDATE ---------------- */
    if (req.io) {
      const checkedInCount = await Registration.countDocuments({
        eventId,
        isCheckedIn: true
      });

      req.io.emit('newCheckin', { eventId, checkedInCount });
    }

    /* ---------------- SUCCESS RESPONSE ---------------- */
    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      registration,
      checkin
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in'
    });
  }
});

module.exports = router;
