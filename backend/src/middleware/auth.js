const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Verifies the Bearer token on every protected route and attaches the decoded
// payload ({ userId, username, role }) to req.user for downstream handlers/middleware.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    const err = new Error('Missing or invalid authorization header.');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    err.expose = true;
    return next(err);
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch (e) {
    const err = new Error('Invalid or expired session. Please log in again.');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    err.expose = true;
    next(err);
  }
}

module.exports = requireAuth;
