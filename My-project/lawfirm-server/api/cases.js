const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// 1. GET ALL CASES — now protected, any logged-in user can view
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, status, area, description, is_emergency, created_on FROM cases ORDER BY created_on DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. GET AVAILABLE CASES — open cases for lawyers to browse
router.get('/available', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, status, area, description, is_emergency, created_on
       FROM cases
       WHERE status = 'open'
       ORDER BY created_on DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching available cases:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. POST — Create a new case (customers only)
router.post('/', authenticate, authorize(['customer']), async (req, res) => {
  const { title, area, description, contact_info, is_emergency } = req.body;

  if (!title || !area || !description || !contact_info) {
    return res.status(400).json({ error: 'Title, area, description, and contact info are required.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO cases (title, status, area, description, contact_info, is_emergency, customer_id)
       VALUES ($1, 'open', $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, area, description, contact_info, is_emergency || false, req.user.id]
    );

    // Emit real-time update via Socket.IO (io attached in server.js)
    if (req.app.get('io')) {
      req.app.get('io').emit('case_update', rows[0]);
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error saving case:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. PUT — Accept a case (lawyers only)
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

    const updatedCase = result.rows[0];

    if (req.app.get('io')) {
      req.app.get('io').emit('case_update', updatedCase);
    }

    res.json({ message: 'Case accepted successfully.', case: updatedCase });
  } catch (err) {
    console.error('Error accepting case:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. PUT — Close a case with judgment (assigned lawyer only)
router.put('/:id/close', authenticate, authorize(['lawyer']), async (req, res) => {
  const caseId = req.params.id;
  const { judgment } = req.body;

  if (!judgment) {
    return res.status(400).json({ error: 'Judgment text is required to close a case.' });
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
      return res.status(403).json({ error: 'Unauthorized or case cannot be closed.' });
    }

    const closedCase = result.rows[0];

    if (req.app.get('io')) {
      req.app.get('io').emit('case_update', closedCase);
    }

    res.json({ message: 'Case resolved and closed successfully.', case: closedCase });
  } catch (err) {
    console.error('Error closing case:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;