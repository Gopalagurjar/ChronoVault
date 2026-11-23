const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render's proxy
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://esm.sh'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'https://esm.sh'],
      },
    },
  }));
  app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','), methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
  app.use(express.json({ limit: '8mb' })); // 5 MB of content grows ~33% as base64

  const strict = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, try again later' } });
  const general = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });

  app.use('/api/auth', strict, require('./routes/auth'));
  app.use('/api/access', strict);
  app.use('/api/events', strict);
  app.use('/api', general);
  app.use('/api/capsules', require('./routes/capsules'));
  app.use('/api/contacts', require('./routes/contacts'));
  app.use('/api', require('./routes/misc'));
  app.use('/api', require('./routes/access'));
  // Serve the prebuilt web app (server/public) so no bundler or native tools are needed.
  const pub = path.join(__dirname, '..', 'public');
  if (fs.existsSync(path.join(pub, 'index.html'))) {
    app.use(express.static(pub));
    app.get(/^\/(?!api(\/|$)).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));
  }
  app.use((req, res) => res.status(404).json({ message: 'Not found' }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };