const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing Authorization token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.account = payload; // { accountId, email, role }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token) {
    try {
      req.account = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Invalid token: proceed unauthenticated.
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
