const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Admin login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Add console logs for debugging
    console.log('Login attempt:', username);

    // Your admin credentials check
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign(
        { username: username, role: 'admin' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        token: token,
        user: { username: username, role: 'admin' }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;