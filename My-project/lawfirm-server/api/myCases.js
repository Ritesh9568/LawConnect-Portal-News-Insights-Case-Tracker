const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../db');
require('dotenv').config();

// Middleware to check token
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded; // Contains: { id, email, role }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET cases for logged-in user (Adapts to both Lawyer and Customer roles)
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query = '';
    let queryParams = [userId];

    if (userRole === 'lawyer') {
      // Lawyers: See cases assigned to them (includes customer contact details & final judgments)
      query = `
        SELECT id, title, status, area, description, contact_info, judgment, assigned_date, created_on 
        FROM cases 
        WHERE assigned_to = $1 
        ORDER BY created_on DESC`;
        
    } else if (userRole === 'customer') {
      // Customers: See cases they created themselves
      query = `
        SELECT id, title, status, area, description, contact_info, judgment, created_on 
        FROM cases 
        WHERE customer_id = $1 
        ORDER BY created_on DESC`;
        
    } else {
      // Readers don't own or handle specific cases
      return res.status(403).json({ error: 'Access Denied: Readers do not have personal case profiles.' });
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching my cases:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;