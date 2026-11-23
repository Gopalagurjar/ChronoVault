/**
 * Encryption Module (pure functions, no Express / MongoDB dependency).
 *
 *  - Each capsule gets a random 256-bit data key (DEK) and a random 96-bit IV.
 *  - Content is encrypted with AES-256-GCM (confidentiality + tamper detection via the GCM tag).
 *  - The DEK is wrapped with the server master key (KEK) and stored as  IV2 | tag | ciphertext.
 *  - contentHash = HMAC-SHA256(plaintext) with a separate integrity key (never a plain hash).
 *
 * The KEK and the integrity key live only in environment variables, never in the database.
 */
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function keys() {
  const kek = Buffer.from(process.env.MASTER_KEY || '', 'hex');
  const hkey = Buffer.from(process.env.INTEGRITY_KEY || '', 'hex');
  if (kek.length !== 32) throw new Error('MASTER_KEY must be 32 bytes (64 hex characters)');
  if (hkey.length !== 32) throw new Error('INTEGRITY_KEY must be 32 bytes (64 hex characters)');
  return { kek, hkey };
}

function wrap(dek) {
  const { kek } = keys();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, kek, iv);
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

function unwrap(b64) {
  const { kek } = keys();
  const b = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv(ALGO, kek, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]);
}

function hmac(plain) {
  const { hkey } = keys();
  return crypto.createHmac('sha256', hkey).update(plain).digest();
}

/** plain: Buffer -> fields to store. The plaintext and the DEK are not kept. */
function encrypt(plain) {
  if (!Buffer.isBuffer(plain)) throw new TypeError('encrypt() expects a Buffer');
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, dek, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  const out = {
    encryptedContent: ct.toString('base64'),
    iv: iv.toString('base64'),
    authTag: c.getAuthTag().toString('base64'),
    wrappedKey: wrap(dek),
    contentHash: hmac(plain).toString('hex'),
    keyVersion: 1,
  };
  dek.fill(0);
  return out;
}

/** Throws if the ciphertext, IV, tag or wrapped key was altered or the wrong master key is used. */
function decryptAndVerify(cap) {
  const dek = unwrap(cap.wrappedKey);
  const d = crypto.createDecipheriv(ALGO, dek, Buffer.from(cap.iv, 'base64'));
  d.setAuthTag(Buffer.from(cap.authTag, 'base64'));
  const plain = Buffer.concat([d.update(Buffer.from(cap.encryptedContent, 'base64')), d.final()]);
  dek.fill(0);
  const h = hmac(plain);
  const stored = Buffer.from(cap.contentHash || '', 'hex');
  const ok = stored.length === h.length && crypto.timingSafeEqual(h, stored);
  return { plain, ok };
}

/** Random, unguessable link token; only its SHA-256 hash is stored. */
function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { encrypt, decryptAndVerify, generateToken, hashToken };
