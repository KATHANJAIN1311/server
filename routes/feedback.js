const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const Feedback = require('../models/Feedback');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { generateThankYouEmail, generateFeedbackRequestEmail } = require('../utils/emailTemplate');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send thank you messages to attendees
router.post('/send-thankyou', async (req, res) => {
  try {
    const { eventId, attendeeEmails, photoLink } = req.body;

    if (!eventId || !attendeeEmails || !Array.isArray(attendeeEmails)) {
      return res.status(400).json({ success: false, message: 'Event ID and attendee emails are required' });
    }

    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const results = { sent: 0, failed: 0 };

    for (const email of attendeeEmails) {
      try {
        const registration = await Registration.findOne({ eventId, email });
        const attendeeName = registration ? registration.name : 'Valued Attendee';

        const emailHtml = generateThankYouEmail({
          name: attendeeName,
          eventName: event.name,
          photoLink: photoLink || ''
        });

        await transporter.sendMail({
          from: `"Creative Era Events" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `Thank You for Attending ${event.name}! 🎉`,
          html: emailHtml
        });

        results.sent++;
      } catch (error) {
        console.error(`Failed to send thank you email to ${email}:`, error);
        results.failed++;
      }
    }

    res.json({ success: true, message: 'Thank you emails sent', results });
  } catch (error) {
    console.error('Error sending thank you emails:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send feedback requests to attendees
router.post('/send-feedback-request', async (req, res) => {
  try {
    const { eventId, attendeeEmails, customMessage } = req.body;

    if (!eventId || !attendeeEmails || !Array.isArray(attendeeEmails)) {
      return res.status(400).json({ success: false, message: 'Event ID and attendee emails are required' });
    }

    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const results = { sent: 0, failed: 0 };
    const feedbackLink = `${process.env.CLIENT_URL}/feedback/${eventId}`;

    for (const email of attendeeEmails) {
      try {
        const registration = await Registration.findOne({ eventId, email });
        const attendeeName = registration ? registration.name : 'Valued Attendee';

        const emailHtml = generateFeedbackRequestEmail({
          name: attendeeName,
          eventName: event.name,
          feedbackLink,
          customMessage: customMessage || ''
        });

        await transporter.sendMail({
          from: `"Creative Era Events" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `We'd Love Your Feedback on ${event.name}! 💭`,
          html: emailHtml
        });

        results.sent++;
      } catch (error) {
        console.error(`Failed to send feedback request to ${email}:`, error);
        results.failed++;
      }
    }

    res.json({ success: true, message: 'Feedback requests sent', results });
  } catch (error) {
    console.error('Error sending feedback requests:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit feedback
router.post('/submit', async (req, res) => {
  try {
    const { eventId, name, email, rating, feedback } = req.body;

    if (!eventId || !name || !email) {
      return res.status(400).json({ success: false, message: 'Event ID, name, and email are required' });
    }

    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const registration = await Registration.findOne({ eventId, email });

    const newFeedback = new Feedback({
      feedbackId: uuidv4(),
      eventId,
      registrationId: registration ? registration.registrationId : null,
      name,
      email,
      rating: rating || null,
      feedback: feedback || ''
    });

    await newFeedback.save();

    res.status(201).json({ success: true, message: 'Feedback submitted successfully', data: newFeedback });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all feedback for an event
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const feedbacks = await Feedback.find({ eventId }).sort({ submittedAt: -1 });

    const avgRating = feedbacks.length > 0
      ? feedbacks.filter(f => f.rating).reduce((sum, f) => sum + f.rating, 0) / feedbacks.filter(f => f.rating).length
      : 0;

    res.json({
      success: true,
      data: feedbacks,
      count: feedbacks.length,
      averageRating: avgRating.toFixed(1)
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get feedback statistics for an event
router.get('/stats/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const feedbacks = await Feedback.find({ eventId });
    const totalFeedbacks = feedbacks.length;
    const ratingsCount = feedbacks.filter(f => f.rating).length;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach(f => {
      if (f.rating) ratingDistribution[f.rating]++;
    });

    const avgRating = ratingsCount > 0
      ? feedbacks.filter(f => f.rating).reduce((sum, f) => sum + f.rating, 0) / ratingsCount
      : 0;

    res.json({
      success: true,
      data: {
        totalFeedbacks,
        ratingsCount,
        averageRating: avgRating.toFixed(1),
        ratingDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
