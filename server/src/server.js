const mongoose = require('mongoose');
const { loadConfig } = require('./config');

async function main() {
  const cfg = loadConfig();
  // make the validated secrets visible to the pure Encryption Module and the JWT middleware
  process.env.MASTER_KEY = cfg.masterKey;
  process.env.INTEGRITY_KEY = cfg.integrityKey;
  process.env.JWT_SECRET = cfg.jwtSecret;

  await mongoose.connect(cfg.mongoUri);
  console.log('MongoDB connected');

  const { createApp } = require('./app');
  const app = createApp();
  app.listen(cfg.port, () => console.log(`ChronoVault API listening on port ${cfg.port}`));

  if (!cfg.disableScheduler) {
    const { createScheduler } = require('./services/scheduler');
    const scheduler = createScheduler({
      repo: require('./services/capsuleRepo'),
      mailer: require('./services/mailer'),
      encryption: require('./services/encryption'),
    });
    scheduler.start(cfg.cronExpr);
    console.log(`Scheduler started (${cfg.cronExpr})`);
  }
}

main().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
