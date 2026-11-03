const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const { requireLogin, requireRole } = require('./middleware/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing and CORS middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Configuration
app.use(session({
  name: 'carbonlens.sid',
  secret: process.env.SESSION_SECRET || 'carbonlens_secret_key_duet_cs2104',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// =============================================================================
// PAGE ROUTES (HTML Views)
// =============================================================================

// Root Route: Smart redirect based on session
app.get('/', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  const role = req.session.user.role;
  if (role === 'admin') return res.redirect('/admin');
  if (role === 'chairperson') return res.redirect('/chairperson');
  if (role === 'student') return res.redirect('/student');
  return res.redirect('/login');
});

// Login Page
app.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Administrator Dashboard
app.get('/admin', requireRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Chairperson Dashboard
app.get('/chairperson', requireRole('chairperson'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chairperson.html'));
});

// Student Dashboard
app.get('/student', requireRole('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'student.html'));
});

// Friendly Access Denied / Error Page
app.get('/access-denied', (req, res) => {
  res.status(403).sendFile(path.join(__dirname, 'views', 'error.html'));
});

// =============================================================================
// API REST ROUTES
// =============================================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chairperson', require('./routes/chairperson'));
app.use('/api/student', require('./routes/student'));
app.use('/api/leaderboards', require('./routes/leaderboards'));

// 404 Handler
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  return res.status(404).sendFile(path.join(__dirname, 'views', 'error.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(`  CarbonLens: Smart Campus Carbon Footprint Tracker (CS-2104)`);
  console.log(`  Campus: ${process.env.CAMPUS_NAME || 'Dawood University of Engineering & Technology (DUET)'}`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`==================================================================`);
});

module.exports = app;
