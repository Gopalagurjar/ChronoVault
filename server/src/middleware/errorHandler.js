class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Never log request bodies, keys or plaintext (SEC: no sensitive data in logs).
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ message: 'Content is too large (limit 5 MB)' });
  if (err && err.name === 'CastError') return res.status(404).json({ message: 'Not found' });
  console.error('Unhandled error:', err && err.message);
  return res.status(500).json({ message: 'Something went wrong' });
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, errorHandler, wrap };
