const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
require('dotenv').config();

const eventRoutes = require('./routes/events');
const registrationRoutes = require('./routes/registrations');
const checkinRoutes = require('./routes/checkins');
const consultationRoutes = require('./routes/consultations');
const adminRoutes = require('./routes/admin');
const bookingRoutes = require('./routes/bookings');

const app = express();
const server = http.createServer(app);

// Trust proxy (REQUIRED for Hostinger)
app.set('trust proxy', 1);

const io = socketIo(server, {
  cors: {
    origin: [
      'https://creativeeraevents.in',
      'https://www.creativeeraevents.in',
      "http://localhost:3005",
      'http://localhost:3000'
    ],
    methods: ["GET", "POST"]
  }
});

// CORS Configuration (MUST come before CSRF)
app.use(cors({
  origin: [
    "https://creativeeraevents.in",
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: "none",
    secure: true
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply CSRF protection to all /api routes
app.use('/api', csrfProtection);

// Socket.io connection
// amazonq-ignore-next-line
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Routes
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
