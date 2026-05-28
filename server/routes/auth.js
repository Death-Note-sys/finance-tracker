const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const authenticate = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
} = require('../middleware/validate');

const router = express.Router();

/**
 * Generate a JWT for the given user.
 * Token expires in 7 days.
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ─────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if email already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    // Hash the password (10 salt rounds)
    const password_hash = await bcrypt.hash(password, 10);

    // Insert the new user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, password_hash]
    );

    const newUser = {
      id: result.insertId,
      username,
      email,
    };

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          preferred_currency: 'INR',
        },
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration.',
    });
  }
});

// ─────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = rows[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          preferred_currency: user.preferred_currency,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
});

// ─────────────────────────────────────────────────
// GET /api/auth/profile  (protected)
// ─────────────────────────────────────────────────
router.get('/profile', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, preferred_currency, created_at, updated_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching profile.',
    });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/auth/profile  (protected)
// ─────────────────────────────────────────────────
router.put('/profile', authenticate, validateProfileUpdate, async (req, res) => {
  try {
    const { preferred_currency } = req.body;

    await pool.query(
      'UPDATE users SET preferred_currency = ? WHERE id = ?',
      [preferred_currency, req.user.userId]
    );

    const [rows] = await pool.query(
      'SELECT id, username, email, preferred_currency, created_at, updated_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating profile.',
    });
  }
});

module.exports = router;
