const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const socketIO = require('socket.io');
const axios = require('axios');
const fetch = require('node-fetch');
require('dotenv').config();

const pool = require('./db');
const { authenticate, authorize } = require('./middleware/auth');

const authRoutes = require('./api/auth');
const caseRoutes = require('./api/cases');
const myCasesRoutes = require('./api/myCases');
const readerRoutes = require('./api/reader');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors: { origin: '*' }
});

// Make io accessible inside route handlers via req.app.get('io')
app.set('io', io);

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/my-cases', myCasesRoutes);
app.use('/api/reader', readerRoutes);

console.log('✅ All routes mounted.');

// ─── NEWS API PROXY ───────────────────────────────────────────────────────────
// Keeps the Anthropic API key server-side. Frontend posts query, gets articles back.
app.post('/api/news', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are a legal news research assistant. Find 10 recent real news articles about the given topic from credible sources (Bar & Bench, LiveLaw, The Hindu, Indian Express, Reuters, etc.).
Return ONLY a valid JSON array — no markdown, no backticks — with exactly this structure:
[{ "title":"...", "excerpt":"2-3 sentence summary", "category":"...", "date":"...", "source":"...", "url":"https://...", "fullSummary":"5-6 sentence detailed summary" }]
Return exactly 10 items. Dates and URLs must be real.`,
        messages: [{ role: 'user', content: `Find 10 recent news articles about: ${query}` }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('News proxy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DASHBOARD ROUTE (now protected) ─────────────────────────────────────────
// Moved here from api/reader.js to keep it co-located with the news API key logic.
// Requires a valid token — any role can view the dashboard.
app.get('/api/reader/dashboard', authenticate, async (req, res) => {
  try {
    const casesQuery = await pool.query(`
      SELECT id, title, status, area, created_on
      FROM cases
      WHERE status IN ('open', 'pending')
      ORDER BY created_on DESC
    `);

    const lawyersQuery = await pool.query(`
      SELECT name, specialization, cases_won, cases_lost
      FROM lawyers
      ORDER BY cases_won DESC
    `);

    let newsArticles = [];

    // Try primary then secondary news API key
    const keys = [process.env.NEWS_API_KEY_PRIMARY, process.env.NEWS_API_KEY_SECONDARY].filter(Boolean);
    for (const key of keys) {
      try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: { q: 'law OR legal', language: 'en', pageSize: 5, apiKey: key },
          timeout: 4000
        });
        newsArticles = response.data.articles.map((art, idx) => ({
          id: `ext-${idx}`,
          title: art.title,
          summary: art.description,
          url: art.url
        }));
        break;
      } catch (err) {
        console.warn(`News API key failed, trying next.`);
      }
    }

    // DB fallback if both keys fail
    if (newsArticles.length === 0) {
      const localNews = await pool.query(`
        SELECT id, title, summary, published_at
        FROM news
        ORDER BY published_at DESC
        LIMIT 5
      `);
      newsArticles = localNews.rows;
    }

    res.json({
      success: true,
      cases: casesQuery.rows,
      leaderboard: lawyersQuery.rows,
      news: newsArticles
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Dashboard error.' });
  }
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('sendMessage', ({ caseId, from, text, time }) => {
    // Broadcast to all clients (in a real app, scope to a room by caseId)
    io.emit('newMessage', { caseId, from, text, time });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});