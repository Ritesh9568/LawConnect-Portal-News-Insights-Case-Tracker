const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET: Public dashboard data for the Reader role
router.get('/dashboard', async (req, res) => {
  try {
    // 1. Fetch ongoing trials (open or pending)
    // Note: Enterprise standard avoids exposing raw internal IDs to unauthenticated readers if possible, 
    // but keeping it here for your dynamic frontend UI table assignment tracking.
    const ongoingCases = await pool.query(
      `SELECT id, title, area, status, created_on 
       FROM cases 
       WHERE status IN ('open', 'pending') 
       ORDER BY created_on DESC`
    );

    // 2. Upgraded Lawyer tracking leaderboard using an explicit JOIN
    // This extracts the live email or updated profile metrics securely.
    const lawyerLeaderboard = await pool.query(
      `SELECT l.id, l.name, l.specialization, l.cases_won, l.cases_lost, u.email
       FROM lawyers l
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.cases_won DESC`
    );

    // 3. Fetch public news
    const newsFeed = await pool.query(
      `SELECT id, title, summary, published_at 
       FROM news 
       ORDER BY published_at DESC LIMIT 10`
    );

    // Deliver unified payload response
    res.json({
      success: true,
      cases: ongoingCases.rows,
      leaderboard: lawyerLeaderboard.rows,
      news: newsFeed.rows
    });

  } catch (err) {
    console.error('Reader dashboard data fetch failure:', err);
    res.status(500).json({ error: 'Failed to compile public records panel' });
  }
});

module.exports = router;