const crypto = require('crypto');
process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
process.env.INTEGRITY_KEY = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = 'test-secret-test-secret';
