const jwt = require('jsonwebtoken');

/** Protects an endpoint: 401 without a valid, unexpired JWT. */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

module.exports = { authMiddleware };
