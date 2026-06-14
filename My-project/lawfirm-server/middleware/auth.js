const jwt = require('jsonwebtoken');

// ─── AUTHENTICATE ────────────────────────────────────────────────────────────
// Verifies the JWT token on every protected request.
// Attaches decoded user payload ({ id, email, role }) to req.user.
// Hard-fails if JWT_SECRET is missing — no silent fallback.

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('FATAL: JWT_SECRET is not set.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ─── AUTHORIZE ───────────────────────────────────────────────────────────────
// Call after authenticate. Accepts an array of allowed roles.
// Usage: authorize(['lawyer', 'admin'])

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };