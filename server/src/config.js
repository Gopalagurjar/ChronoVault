require('dotenv').config();

const hex32 = (name) => {
  const v = process.env[name];
  if (!v || !/^[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error(`${name} must be a 64-character hex string (32 bytes). Run "npm run keys" to generate one.`);
  }
  return v;
};

function loadConfig() {
  return {
    port: Number(process.env.PORT) || 5000,
    env: process.env.NODE_ENV || 'development',
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chronovault',
    masterKey: hex32('MASTER_KEY'),
    integrityKey: hex32('INTEGRITY_KEY'),
    jwtSecret: (() => {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) throw new Error('JWT_SECRET must be set (16+ chars).');
      return process.env.JWT_SECRET;
    })(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    cronExpr: process.env.CRON_EXPR || '* * * * *',
    disableScheduler: process.env.DISABLE_SCHEDULER === 'true',
  };
}

module.exports = { loadConfig };
