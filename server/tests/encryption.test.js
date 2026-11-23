const crypto = require('crypto');
const { encrypt, decryptAndVerify, generateToken, hashToken } = require('../src/services/encryption');

const plain = Buffer.from('Dear future me, remember to be kind.');

describe('Encryption module', () => {
  test('encrypt -> decrypt round trip returns the original and passes the integrity check', () => {
    const rec = encrypt(plain);
    const { plain: out, ok } = decryptAndVerify(rec);
    expect(out.equals(plain)).toBe(true);
    expect(ok).toBe(true);
  });

  test('stored record contains no plaintext', () => {
    const rec = encrypt(plain);
    expect(JSON.stringify(rec)).not.toContain('Dear future me');
    expect(Object.keys(rec).sort()).toEqual(['authTag', 'contentHash', 'encryptedContent', 'iv', 'keyVersion', 'wrappedKey']);
  });

  test('a different IV and a different wrapped key are produced on every call', () => {
    const a = encrypt(plain);
    const b = encrypt(plain);
    expect(a.iv).not.toBe(b.iv);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
    expect(a.encryptedContent).not.toBe(b.encryptedContent);
  });

  test('IV is 96 bits and the GCM tag is 128 bits', () => {
    const rec = encrypt(plain);
    expect(Buffer.from(rec.iv, 'base64').length).toBe(12);
    expect(Buffer.from(rec.authTag, 'base64').length).toBe(16);
  });

  test('decryption fails when one ciphertext byte is changed', () => {
    const rec = encrypt(plain);
    const buf = Buffer.from(rec.encryptedContent, 'base64');
    buf[0] ^= 0x01;
    expect(() => decryptAndVerify({ ...rec, encryptedContent: buf.toString('base64') })).toThrow();
  });

  test('decryption fails when the authentication tag is changed', () => {
    const rec = encrypt(plain);
    const tag = Buffer.from(rec.authTag, 'base64');
    tag[3] ^= 0xff;
    expect(() => decryptAndVerify({ ...rec, authTag: tag.toString('base64') })).toThrow();
  });

  test('decryption fails when the wrong master key is used', () => {
    const rec = encrypt(plain);
    const saved = process.env.MASTER_KEY;
    process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
    expect(() => decryptAndVerify(rec)).toThrow();
    process.env.MASTER_KEY = saved;
  });

  test('HMAC mismatch is detected even when decryption itself succeeds', () => {
    const rec = encrypt(plain);
    const wrong = crypto.createHmac('sha256', Buffer.alloc(32, 7)).update(plain).digest('hex');
    expect(decryptAndVerify({ ...rec, contentHash: wrong }).ok).toBe(false);
    expect(decryptAndVerify({ ...rec, contentHash: 'abcd' }).ok).toBe(false);
  });

  test('contentHash is a keyed HMAC, not a plain SHA-256', () => {
    const rec = encrypt(plain);
    const sha = crypto.createHash('sha256').update(plain).digest('hex');
    expect(rec.contentHash).not.toBe(sha);
  });

  test('works for empty-ish and large (5 MB) content', () => {
    const big = crypto.randomBytes(5 * 1024 * 1024);
    const { plain: out, ok } = decryptAndVerify(encrypt(big));
    expect(ok).toBe(true);
    expect(out.equals(big)).toBe(true);
  });

  test('encrypt rejects non-Buffer input', () => {
    expect(() => encrypt('a string')).toThrow(TypeError);
  });

  test('rejects missing or short keys', () => {
    const saved = process.env.MASTER_KEY;
    process.env.MASTER_KEY = 'abcd';
    expect(() => encrypt(plain)).toThrow(/MASTER_KEY/);
    process.env.MASTER_KEY = saved;
    const savedH = process.env.INTEGRITY_KEY;
    process.env.INTEGRITY_KEY = '';
    expect(() => encrypt(plain)).toThrow(/INTEGRITY_KEY/);
    process.env.INTEGRITY_KEY = savedH;
  });

  test('link tokens are random, unguessable and stored only as a hash', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toHaveLength(64);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).not.toBe(a.token);
  });
});
