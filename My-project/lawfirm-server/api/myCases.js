const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET — Cases for the logged-in user (adapts to lawyer and customer roles)
router.get('/', authenticate, authorize(['lawyer', 'customer']), async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query, queryParams;

    if (userRole === 'lawyer') {
      query = `
        SELECT id, title, status, area, description, contact_info, judgment, assigned_date, created_on
        FROM cases
        WHERE assigned_to = $1
        ORDER BY created_on DESC`;
      queryParams = [userId];

    } else {
      // customer
      query = `
        SELECT id, title, status, area, description, contact_info, judgment, created_on
        FROM cases
        WHERE customer_id = $1
        ORDER BY created_on DESC`;
      queryParams = [userId];
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching my cases:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;