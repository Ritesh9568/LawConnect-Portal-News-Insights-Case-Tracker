const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const socketIO = require('socket.io');
const axios = require('axios');
require('dotenv').config();

const pool = require('./db');
const authRoutes = require('./api/auth');   // ✅ Added
const caseRoutes = require('./api/cases');     // ADD THIS
const myCasesRoutes = require('./api/myCases'); // ADD THIS
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin: '*'
    }
});


// ─── MIDDLEWARES ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'Public')));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ REGISTER AUTH ROUTES
app.use('/api', authRoutes);
app.use('/api/cases', caseRoutes);             // ADD THIS
app.use('/api/my-cases', myCasesRoutes);   
console.log("✅ Auth routes mounted at /api");

// ─── API KEY ROTATION LOGIC ──────────────────────────────────────────────────
const getNewsApiKey = (attempt = 0) => {
    const keys = [
        process.env.NEWS_API_KEY_PRIMARY,
        process.env.NEWS_API_KEY_SECONDARY
    ];

    return keys[attempt % keys.length];
};

// ─── AUTHENTICATION ENGINE ──────────────────────────────────────────────────
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(403).json({
            error: 'No token provided.'
        });
    }

    try {
        req.user = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        next();
    } catch (err) {
        return res.status(401).json({
            error: 'Invalid or expired token.'
        });
    }
};

const authorize = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            error: 'Access Denied.'
        });
    }

    next();
};

// ─── NEWS & DASHBOARD ENDPOINT ───────────────────────────────────────────────
app.get('/api/reader/dashboard', async (req, res) => {
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

        // Try API keys one by one
        for (let i = 0; i < 2; i++) {
            try {
                const response = await axios.get(
                    'https://newsapi.org/v2/everything',
                    {
                        params: {
                            q: 'law OR legal',
                            language: 'en',
                            pageSize: 5,
                            apiKey: getNewsApiKey(i)
                        },
                        timeout: 4000
                    }
                );

                newsArticles = response.data.articles.map((art, idx) => ({
                    id: `ext-${idx}`,
                    title: art.title,
                    summary: art.description,
                    url: art.url
                }));

                break;
            } catch (err) {
                console.warn(`News API Key ${i + 1} failed.`);
            }
        }

        // Database fallback
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
        console.error('Dashboard Error:', err);

        res.status(500).json({
            error: 'Dashboard error.'
        });
    }
});


// News proxy route — add this with your other routes
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


// ─── CASE OPERATIONS & SOCKETS ──────────────────────────────────────────────
// Keep your existing Case CRUD, LISTEN/NOTIFY, and Socket.IO code here.

// ─── SERVER START ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 Portal streaming on port ${PORT}`);
    console.log(`🔐 Auth APIs available at:`);
    console.log(`   POST http://localhost:${PORT}/login.html`);
    console.log(`   POST http://localhost:${PORT}/register.html`);
});