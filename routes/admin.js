const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Simple admin login (you can replace with database logic later)
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Simple hardcoded check (replace with database check later)
    if (username === 'admin' && password === 'admin123') {
      // Generate token
      const token = jwt.sign(
        { username: username, role: 'admin' },
        process.env.JWT_SECRET || 'your-secret-key-here',
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        token: token,
        user: { username: 'admin', role: 'admin' }
      });
    }

    // Invalid credentials
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes are accessible!' });
});

module.exports = router;