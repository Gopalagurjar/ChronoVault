const encryption = require('../src/services/encryption');
const { createScheduler } = require('../src/services/scheduler');
const { DAY } = require('../src/services/evaluators');

/** In-memory stand-in for the Mongoose repository, with the same atomic-claim semantics. */
function makeRepo(capsules) {
  const db = new Map(capsules.map((c) => [c._id, { ...c }]));
  const view = (c) => ({ ...c });
  return {
    db,
    async findLocked() { return [...db.values()].filter((c) => c.status === 'LOCKED').map(view); },
    async findUnlockedUndelivered() { return [...db.values()].filter((c) => c.status === 'UNLOCKED' && !c.deliveredAt).map(view); },
    async claim(id, now) { const c = db.get(id); if (c.status !== 'LOCKED' || (c.processingAt && now - c.processingAt < 300000)) return false; c.processingAt = now; return true; },
    async claimDelivery(id, now) { const c = db.get(id); if (c.status !== 'UNLOCKED' || c.deliveredAt || (c.processingAt && now - c.processingAt < 300000)) return false; c.processingAt = now; return true; },
    async release(id) { db.get(id).processingAt = null; },
    async markUnlocked(id, f) { const c = db.get(id); if (c.status !== 'LOCKED') return false; Object.assign(c, f, { status: 'UNLOCKED' }); return true; },
    async setToken(id, f) { Object.assign(db.get(id), f); },
    async markDelivered(id, now) { Object.assign(db.get(id), { status: 'DELIVERED', deliveredAt: now, processingAt: null }); },
    async markTampered(id) { Object.assign(db.get(id), { status: 'TAMPERED', processingAt: null }); },
    async markReminderSent(id, now) { db.get(id).reminderSentAt = now; },
  };
}

const owner = { name: 'Aarav', email: 'aarav@example.com', lastCheckIn: new Date('2027-01-01T00:00:00Z') };
function capsule(over = {}) {
  return { _id: 'c1', title: 'Letter', status: 'LOCKED', unlockMode: 'date', unlockDate: new Date('2027-03-15T09:00:00Z'), recipientEmail: 'riya@example.com', owner, ...encryption.encrypt(Buffer.from('secret')), ...over };
}
function makeMailer(fail = false) {
  const sent = { unlock: [], tamper: [], reminder: [] };
  return {
    sent,
    async sendUnlockEmail(m) { if (fail) throw new Error('SMTP down'); sent.unlock.push(m); },
    async sendTamperAlert(m) { sent.tamper.push(m); },
    async sendCheckInReminder(m) { sent.reminder.push(m); },
  };
}
const quiet = { error() {}, log() {} };
const at = (iso) => () => new Date(iso);

describe('Scheduler', () => {
  test('before the unlock time the capsule stays LOCKED and nothing is sent', async () => {
    const repo = makeRepo([capsule()]); const mailer = makeMailer();
    const s = createScheduler({ repo, mailer, encryption, now: at('2027-03-15T08:59:59Z'), logger: quiet });
    const r = await s.runOnce();
    expect(repo.db.get('c1').status).toBe('LOCKED');
    expect(mailer.sent.unlock).toHaveLength(0);
    expect(r.waiting).toBe(1);
  });

  test('after the unlock time: UNLOCKED then DELIVERED with an unguessable link, never the content', async () => {
    const repo = makeRepo([capsule()]); const mailer = makeMailer();
    const s = createScheduler({ repo, mailer, encryption, now: at('2027-03-15T09:00:30Z'), logger: quiet });
    const r = await s.runOnce();
    const c = repo.db.get('c1');
    expect(c.status).toBe('DELIVERED');
    expect(c.deliveredAt).toBeInstanceOf(Date);
    expect(mailer.sent.unlock).toHaveLength(1);
    expect(mailer.sent.unlock[0].to).toBe('riya@example.com');
    expect(JSON.stringify(mailer.sent.unlock[0])).not.toContain('secret');
    expect(encryption.hashToken(mailer.sent.unlock[0].token)).toBe(c.accessTokenHash);
    expect(r.delivered).toBe(1);
  });

  test('altered ciphertext -> TAMPERED, creator alerted, nothing delivered', async () => {
    const cap = capsule();
    const b = Buffer.from(cap.encryptedContent, 'base64'); b[0] ^= 1; cap.encryptedContent = b.toString('base64');
    const repo = makeRepo([cap]); const mailer = makeMailer();
    const s = createScheduler({ repo, mailer, encryption, now: at('2027-03-16T00:00:00Z'), logger: quiet });
    const r = await s.runOnce();
    expect(repo.db.get('c1').status).toBe('TAMPERED');
    expect(mailer.sent.unlock).toHaveLength(0);
    expect(mailer.sent.tamper).toHaveLength(1);
    expect(r.tampered).toBe(1);
  });

  test('an HMAC mismatch is also treated as TAMPERED', async () => {
    const repo = makeRepo([capsule({ contentHash: 'ab'.repeat(32) })]); const mailer = makeMailer();
    await createScheduler({ repo, mailer, encryption, now: at('2027-03-16T00:00:00Z'), logger: quiet }).runOnce();
    expect(repo.db.get('c1').status).toBe('TAMPERED');
  });

  test('inactivity capsule unlocks only after the period without check-in', async () => {
    const cap = capsule({ unlockMode: 'inactivity', unlockDate: undefined, inactivityDays: 30 });
    const repo = makeRepo([cap]); const mailer = makeMailer();
    const before = new Date(owner.lastCheckIn.getTime() + 30 * DAY - 1);
    await createScheduler({ repo, mailer, encryption, now: () => before, logger: quiet }).runOnce();
    expect(repo.db.get('c1').status).toBe('LOCKED');
    await createScheduler({ repo, mailer, encryption, now: () => new Date(before.getTime() + 1), logger: quiet }).runOnce();
    expect(repo.db.get('c1').status).toBe('DELIVERED');
  });

  test('a check-in reminder is sent once inside the warning window', async () => {
    const cap = capsule({ unlockMode: 'inactivity', unlockDate: undefined, inactivityDays: 10 });
    const repo = makeRepo([cap]); const mailer = makeMailer();
    const t = () => new Date(owner.lastCheckIn.getTime() + 8 * DAY);
    const s = createScheduler({ repo, mailer, encryption, now: t, logger: quiet });
    await s.runOnce(); await s.runOnce();
    expect(mailer.sent.reminder).toHaveLength(1);
    expect(repo.db.get('c1').status).toBe('LOCKED');
  });

  test('event capsule unlocks only after the trusted contact confirms', async () => {
    const cap = capsule({ unlockMode: 'event', unlockDate: undefined, eventName: 'Graduation', eventConfirmed: false });
    const repo = makeRepo([cap]); const mailer = makeMailer();
    const s = createScheduler({ repo, mailer, encryption, now: at('2030-01-01T00:00:00Z'), logger: quiet });
    await s.runOnce();
    expect(repo.db.get('c1').status).toBe('LOCKED');
    repo.db.get('c1').eventConfirmed = true;
    await s.runOnce();
    expect(repo.db.get('c1').status).toBe('DELIVERED');
  });

  test('SMTP failure: capsule stays UNLOCKED, failure logged, retried on the next cycle', async () => {
    const repo = makeRepo([capsule()]);
    const errors = []; const logger = { error: (...a) => errors.push(a.join(' ')), log() {} };
    const t = at('2027-03-15T10:00:00Z');
    await createScheduler({ repo, mailer: makeMailer(true), encryption, now: t, logger }).runOnce();
    expect(repo.db.get('c1').status).toBe('UNLOCKED');
    expect(errors.length).toBeGreaterThan(0);
    const good = makeMailer();
    const r = await createScheduler({ repo, mailer: good, encryption, now: t, logger }).runOnce();
    expect(repo.db.get('c1').status).toBe('DELIVERED');
    expect(good.sent.unlock).toHaveLength(1);
    expect(r.retried).toBe(1);
  });

  test('two overlapping runs unlock and e-mail the capsule exactly once (atomic claim)', async () => {
    const repo = makeRepo([capsule()]); const mailer = makeMailer();
    const mk = () => createScheduler({ repo, mailer, encryption, now: at('2027-03-15T09:05:00Z'), logger: quiet });
    await Promise.all([mk().runOnce(), mk().runOnce()]);
    expect(mailer.sent.unlock).toHaveLength(1);
    expect(repo.db.get('c1').status).toBe('DELIVERED');
  });

  test('catch-up: a run long after the unlock time still processes the due capsule', async () => {
    const repo = makeRepo([capsule()]); const mailer = makeMailer();
    await createScheduler({ repo, mailer, encryption, now: at('2031-01-01T00:00:00Z'), logger: quiet }).runOnce();
    expect(repo.db.get('c1').status).toBe('DELIVERED');
  });

  test('an unexpected error keeps the capsule LOCKED (fail safe)', async () => {
    const repo = makeRepo([capsule()]);
    repo.claim = async () => { throw new Error('db hiccup'); };
    await createScheduler({ repo, mailer: makeMailer(), encryption, now: at('2027-03-16T00:00:00Z'), logger: quiet }).runOnce();
    expect(repo.db.get('c1').status).toBe('LOCKED');
  });

  test('a run that is still in progress is not started twice in the same process', async () => {
    const repo = makeRepo([capsule()]);
    const orig = repo.findLocked; repo.findLocked = async () => { await new Promise((r) => setTimeout(r, 20)); return orig(); };
    const s = createScheduler({ repo, mailer: makeMailer(), encryption, now: at('2027-03-16T00:00:00Z'), logger: quiet });
    const [a, b] = await Promise.all([s.runOnce(), s.runOnce()]);
    expect([a.skipped, b.skipped].filter(Boolean)).toHaveLength(1);
  });

  test('already UNLOCKED or TAMPERED capsules are not processed again', async () => {
    const repo = makeRepo([capsule({ _id: 'a', status: 'TAMPERED' }), capsule({ _id: 'b', status: 'DELIVERED', deliveredAt: new Date() })]);
    const mailer = makeMailer();
    await createScheduler({ repo, mailer, encryption, now: at('2031-01-01T00:00:00Z'), logger: quiet }).runOnce();
    expect(mailer.sent.unlock).toHaveLength(0);
  });
});
