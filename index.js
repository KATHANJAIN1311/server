require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5002;

/* =====================================================
   TRUST PROXY (Hostinger / Reverse Proxy)
===================================================== */
app.set('trust proxy', 1);

/* =====================================================
   CORS CONFIG (FIXED)
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
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: false, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', (req, res) => res.sendStatus(204));

/* =====================================================
   BODY PARSER
===================================================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   LOGGING (SAFE)
===================================================== */
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin || 'N/A');
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =====================================================
   SOCKET.IO CONFIG
===================================================== */
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: false
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

/* =====================================================
   DATABASE
===================================================== */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

/* =====================================================
   ADMIN MODEL
===================================================== */
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

/* =====================================================
   INIT DEFAULT ADMIN (SAFE)
===================================================== */
const initializeAdmin = async () => {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.warn('⚠️ Admin env vars missing, skipping admin init');
    return;
  }

  try {
    const exists = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (exists) return console.log('✅ Admin already exists');

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await Admin.create({
      username: process.env.ADMIN_USERNAME,
      password: hashedPassword
    });

    console.log('✅ Default admin created');
  } catch (err) {
    console.error('❌ Admin init error:', err.message);
  }
};

initializeAdmin();

/* =====================================================
   AUTH MIDDLEWARE
===================================================== */
const verifyToken = (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token' });
    }

    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/* =====================================================
   ROUTES
===================================================== */
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server running' });
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Missing fields' });

    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: { id: admin._id, username: admin.username, role: admin.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);

/* =====================================================
   ERROR HANDLING
===================================================== */
app.use((req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' })
);

app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

/* =====================================================
   START SERVER
===================================================== */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

/* =====================================================
   SAFETY
===================================================== */
process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});
