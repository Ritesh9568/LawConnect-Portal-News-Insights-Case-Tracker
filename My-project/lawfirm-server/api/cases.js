const express = require('express');
const router = express.Router();
const pool = require('../db');

// --- AUTHENTICATION & ROLE MIDDLEWARE REPLICAS ---
// (Ensures req.user is populated via JWT)
function authenticate(req, res, next) {
  const jwt = require('jsonwebtoken');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access Denied: Unauthorized role context.' });
    }
    next();
  };
};

// --- ROUTES ---

// 1. GET ALL CASES (Global overview)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, status, area, description, created_on FROM cases ORDER BY created_on DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. GET AVAILABLE CASES (For Lawyers to browse open requests)
router.get('/available', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, status, area, description, is_emergency, created_on FROM cases WHERE status = 'open' ORDER BY created_on DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching available cases:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. POST - Create a new case (🔒 Restricted to Customers)
router.post('/', authenticate, authorize(['customer']), async (req, res) => {
  const { title, area, description, contact_info, is_emergency } = req.body;

  if (!title || !area || !description || !contact_info) {
    return res.status(400).json({ error: 'Title, area, description, and contact info are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO cases (title, status, area, description, contact_info, is_emergency, customer_id)
       VALUES ($1, 'open', $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, area, description, contact_info, is_emergency || false, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error saving case:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. PUT - Accept an open case (🔒 Restricted to Lawyers)
router.put('/:id/accept', authenticate, authorize(['lawyer']), async (req, res) => {
  const caseId = req.params.id;
  try {
    const result = await pool.query(
      `UPDATE cases 
       SET assigned_to = $1, status = 'pending', assigned_date = NOW() 
       WHERE id = $2 AND status = 'open' 
       RETURNING *`,
      [req.user.id, caseId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Case is unavailable or already assigned.' });
    }
    res.json({ message: 'Case accepted successfully', case: result.rows[0] });
  } catch (err) {
    console.error('Error accepting case:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. PUT - Close case with a final judgment (🔒 Restricted to Assigned Lawyer)
router.put('/:id/close', authenticate, authorize(['lawyer']), async (req, res) => {
  const caseId = req.params.id;
  const { judgment } = req.body;

  if (!judgment) {
    return res.status(400).json({ error: 'Judgment details are required to close a case' });
  }

  try {
    const result = await pool.query(
      `UPDATE cases 
       SET status = 'closed', judgment = $1 
       WHERE id = $2 AND assigned_to = $3 AND status = 'pending' 
       RETURNING *`,
      [judgment, caseId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized or case cannot be closed.' });
    }
    res.json({ message: 'Case resolved and closed successfully', case: result.rows[0] });
  } catch (err) {
    console.error('Error closing case:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;