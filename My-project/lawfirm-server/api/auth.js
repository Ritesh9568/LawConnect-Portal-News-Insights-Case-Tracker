const express = require('express');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const router = express.Router();
console.log("✅ api/auth.js loaded");
// --- CRITICAL SECURITY CHECK ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in the environment variables.');
  process.exit(1); // This immediately shuts down the Node server
}

// --- 1. USER REGISTRATION ---
router.post('/register', async (req, res) => {
  const { email, password, role, customer_type } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and system role parameters are required.' });
  }

  try {
    // Hash password securely with 10 salt rounds
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert utilizing the exact column schema definitions
    const result = await pool.query(
      `INSERT INTO users (email, password, role, customer_type) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, role, customer_type`,
      [email, hashedPassword, role, role === 'customer' ? customer_type : null]
    );

    res.status(201).json({ 
      message: 'Legal profile initialized successfully.', 
      user: result.rows[0] 
    });
  } catch (err) {
    // Postgres specific error code for "unique_violation"
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    
    console.error('Error registering user in auth router:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// --- 2. ROLE-BASED LOGIN ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password parameters are mandatory.' });
  }

  try {
    // Lookup user record by unique email identity
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid identification email or password combination.' });
    }

    // Verify hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid identification email or password combination.' });
    }

    // Generate stateless token (Will safely use the required environment variable)
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      JWT_SECRET, // <-- Removed the || 'fallback...' part
      { expiresIn: '24h' }
    );

    // Return the token, role, and sanitized profile metadata
    res.json({ 
      success: true,
      token, 
      role: user.role,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('Error logging in inside auth router:', err);
    res.status(500).json({ error: 'Internal system identity failure.' });
  }
});

module.exports = router;