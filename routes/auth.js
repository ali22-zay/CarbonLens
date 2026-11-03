const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// POST /api/auth/login - Authenticate user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password.'
      });
    }

    // Parameterized SQL query: Fetch user with optional department info
    const [rows] = await db.query(
      `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.role, 
              u.department_id, d.department_name, d.department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const user = rows[0];

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Save user session
    req.session.user = {
      id: user.user_id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
      departmentName: user.department_name,
      departmentCode: user.department_code
    };

    // Determine dashboard redirection based on role
    let redirectUrl = '/student';
    if (user.role === 'admin') {
      redirectUrl = '/admin';
    } else if (user.role === 'chairperson') {
      redirectUrl = '/chairperson';
    }

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      redirectUrl,
      user: {
        id: user.user_id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        departmentName: user.department_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during login.'
    });
  }
});

// POST /api/auth/logout - End user session
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// GET /api/auth/me - Return current logged in user
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      authenticated: true,
      user: req.session.user,
      campusName: process.env.CAMPUS_NAME || 'Dawood University of Engineering & Technology (DUET)'
    });
  }
  return res.json({
    authenticated: false,
    user: null,
    campusName: process.env.CAMPUS_NAME || 'Dawood University of Engineering & Technology (DUET)'
  });
});

module.exports = router;
