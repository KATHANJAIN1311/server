/****************************************************
 * CREATIVE ERA EVENTS - HOSTINGER WEB COMPATIBLE
 * index.js (REPLACE ENTIRE FILE WITH THIS)
 ****************************************************/

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

/* ======================
   ROUTES
====================== */
const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');
const checkinRoutes = require('./routes/checkins');
const consultationRoutes = require('./routes/consultations');
const adminRoutes = require('./routes/admin');
const bookingRoutes = require('./routes/bookings');
const Admin = require('./models/Admin');

const app = express();

/* ======================
   TRUST PROXY (required)
====================== */
app.set('trust proxy', 1);

/* ======================
   CORS
====================== */
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

/* ======================
   STATIC FILES
====================== */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ======================
   DATABASE
====================== */
console.log('🔌 Connecting to MongoDB...');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    console.log('📦 Database:', mongoose.connection.name);
    initializeAdmin();
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

/* ======================
   INITIAL ADMIN
====================== */
async function initializeAdmin() {
  try {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      console.warn('⚠️ Admin credentials not set');
      return;
    }

    const existingAdmin = await Admin.findOne({
      username: process.env.ADMIN_USERNAME
    });

    if (existingAdmin) {
      console.log('✅ Admin user exists');
      return;
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    await Admin.create({
      username: process.env.ADMIN_USERNAME,
      password: hashedPassword,
      role: 'admin'
    });

    console.log('✅ Default admin created');
  } catch (err) {
    console.error('❌ Admin init error:', err.message);
  }
}

/* ======================
   HEALTH ROUTES
====================== */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Creative Era Events API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API endpoint working'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

/* ======================
   API ROUTES
====================== */
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);

/* ======================
   404 HANDLER
====================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

/* ======================
   ERROR HANDLER
====================== */
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

/* ======================
   EXPORT APP (MANDATORY)
====================== */
module.exports = app;
