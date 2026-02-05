require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');
const checkinRoutes = require('./routes/checkins');
const consultationRoutes = require('./routes/consultations');
const adminRoutes = require('./routes/admin');
const bookingRoutes = require('./routes/bookings');
const Admin = require('./models/Admin');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3003;

/* =====================================================
   CORS CONFIGURATION
===================================================== */
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://creativeeraevents.in',
      'https://www.creativeeraevents.in',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('creativeeraevents.in')) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS blocked origin:', origin);
      callback(null, true); // Still allow but log it
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'X-CSRF-Token'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Apply CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Manual CORS headers as backup
app.use((req, res, next) => {
  // res.header('Access-Control-Allow-Origin', 'https://creativeeraevents.in');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Trust proxy
app.set('trust proxy', 1);

/* =====================================================
   MIDDLEWARE
===================================================== */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);
  next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =====================================================
   SOCKET.IO
===================================================== */
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('❌ Socket disconnected:', socket.id));
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* =====================================================
   DATABASE CONNECTION
===================================================== */
console.log('🔌 Connecting to MongoDB...');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
    console.log('📦 Database:', mongoose.connection.name);
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// Monitor connection
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

/* =====================================================
   INITIALIZE DEFAULT ADMIN
===================================================== */
const initializeAdmin = async () => {
  try {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      console.warn('⚠️ Admin credentials not set in .env');
      return;
    }

    const existingAdmin = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    
    if (existingAdmin) {
      console.log('✅ Admin user exists');
      return;
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await Admin.create({
      username: process.env.ADMIN_USERNAME,
      password: hashedPassword,
      role: 'admin'
    });

    console.log('✅ Default admin created');
    console.log(`   Username: ${process.env.ADMIN_USERNAME}`);
  } catch (err) {
    console.error('❌ Error initializing admin:', err.message);
  }
};

// Initialize admin after DB connection
mongoose.connection.once('open', () => {
  initializeAdmin();
});

/* =====================================================
   HEALTH CHECK ROUTES
===================================================== */
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Creative Era Events API is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API endpoint is working',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is healthy',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* =====================================================
   API ROUTES - REGISTER ALL ROUTES
===================================================== */
console.log('📝 Registering API routes...');

app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);

console.log('✅ All routes registered');

/* =====================================================
   ERROR HANDLING
===================================================== */
// 404 handler
app.use((req, res) => {
  console.log('❌ Route not found:', req.method, req.url);
  res.status(404).json({ 
    success: false, 
    message: `Route not found: ${req.method} ${req.url}`,
    availableRoutes: [
      'GET /',
      'GET /api',
      'GET /api/health',
      'POST /api/admin/login',
      'GET /api/events',
      'POST /api/events',
      'GET /api/registrations',
      'POST /api/registrations',
      'GET /api/checkins',
      'POST /api/checkins',
      'GET /api/consultations',
      'POST /api/consultations',
      'GET /api/bookings',
      'POST /api/bookings'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

/* =====================================================
   START SERVER
===================================================== */
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 CREATIVE ERA EVENTS API - SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60));
});

/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, closing server...');
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  process.exit(1);
});