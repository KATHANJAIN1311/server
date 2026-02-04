const jwt = require('jsonwebtoken');

// ✅ Token Generation (Login endpoint)
const generateToken = (userId, role) => {
  return jwt.sign(
    { 
      id: userId, 
      role: role 
    },
    process.env.JWT_SECRET, // Must be set in .env
    { 
      expiresIn: '24h' // or '7d' for longer sessions
    }
  );
};

// ✅ Token Verification Middleware
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }
    
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

module.exports = {
  generateToken,
  verifyToken
};