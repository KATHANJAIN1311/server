require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
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
const feedbackRoutes = require('./routes/feedback');
const Admin = require('./models/Admin');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3003;

/* =====================================================
   CORS MIDDLEWARE
===================================================== */
const allowedOrigins = [
  'https://creativeeraevents.in',
  'https://www.creativeeraevents.in',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 204
}));

app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 204
}));

app.set('trust proxy', 1);

/* =====================================================
   MIDDLEWARE
===================================================== */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Static files
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', (req, res, next) => {
  next();
}, express.static(uploadsPath, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
  },
  fallthrough: true
}));

app.use('/uploads', (req, res) => {
  res.status(404).json({ success: false, message: 'Image not found' });
});

/* =====================================================
   SOCKET.IO
===================================================== */
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) { callback(null, true); },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
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
   DATABASE
===================================================== */
console.log('🔌 Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB Connected:', mongoose.connection.name);
  })
  .catch(err => {
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  });

mongoose.connection.on('error', err => console.error('❌ MongoDB error:', err));
mongoose.connection.on('disconnected', () => console.log('⚠️ MongoDB disconnected'));

/* =====================================================
   ADMIN INIT
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
    await Admin.create({ username: process.env.ADMIN_USERNAME, password: hashedPassword, role: 'admin' });
    console.log('✅ Default admin created:', process.env.ADMIN_USERNAME);
  } catch (err) {
    console.error('❌ Error initializing admin:', err.message);
  }
};
mongoose.connection.once('open', () => { initializeAdmin(); });

/* =====================================================
   HEALTH ROUTES
===================================================== */
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Creative Era Events API', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({ success: true, message: 'API is working', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server healthy',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/cors-test', (req, res) => {
  res.json({ success: true, message: 'CORS is working!', origin: req.headers.origin });
});

/* =====================================================
   ROUTES
===================================================== */
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/feedback', feedbackRoutes);

/* =====================================================
   ERROR HANDLERS
===================================================== */
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

/* =====================================================
   START
===================================================== */
server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 SERVER STARTED');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔗 CORS Test: http://localhost:${PORT}/api/cors-test`);
  console.log('='.repeat(50));
});

process.on('SIGTERM', () => {
  server.close(() => {
    mongoose.connection.close(false, () => { process.exit(0); });
  });
});
process.on('unhandledRejection', (err) => { console.error('❌ Unhandled rejection:', err); });
process.on('uncaughtException', (err) => { console.error('❌ Uncaught exception:', err); process.exit(1); });