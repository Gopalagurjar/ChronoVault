/**
 * Scheduler: evaluates unlock conditions on the server using server time.
 *
 * Safety rules implemented here (see report, Sections 3.2.2 and 3.5):
 *  - fail safe: if anything is in doubt the capsule stays LOCKED;
 *  - atomic claim (processingAt) so two overlapping runs process a capsule at most once;
 *  - decrypt in memory only to verify integrity; plaintext is discarded immediately;
 *  - altered capsules become TAMPERED and are never delivered; the creator is alerted;
 *  - catch-up: a run after downtime processes every capsule that is already due;
 *  - failed e-mail keeps the capsule UNLOCKED and is retried on the next cycle.
 */
const cron = require('node-cron');
const { isDue, needsReminder, inactivityDeadline } = require('./evaluators');

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function createScheduler({ repo, mailer, encryption, now = () => new Date(), logger = console }) {
  let running = false;

  async function deliver(c, now_) {
    const { token, hash } = encryption.generateToken();
    await repo.setToken(c._id, { accessTokenHash: hash, accessTokenExpiry: new Date(now_.getTime() + TOKEN_TTL_MS) });
    await mailer.sendUnlockEmail({ to: c.recipientEmail, ownerName: (c.owner && c.owner.name) || 'Someone', title: c.title, token });
    await repo.markDelivered(c._id, now_);
  }

  async function processLocked(c, t) {
    const owner = c.owner || {};
    if (!isDue(c, owner.lastCheckIn, t)) {
      if (needsReminder(c, owner.lastCheckIn, t) && owner.email) {
        try {
          await mailer.sendCheckInReminder({ to: owner.email, title: c.title, deadline: inactivityDeadline(c, owner.lastCheckIn) });
          await repo.markReminderSent(c._id, t);
        } catch (e) { logger.error('reminder failed:', e.message); }
      }
      return 'waiting';
    }

    if (!(await repo.claim(c._id, t))) return 'skipped'; // another run holds it

    let ok = false;
    try {
      const r = encryption.decryptAndVerify(c); // plaintext is verified and dropped, never stored
      ok = r.ok === true;
      r.plain = null;
    } catch (e) { ok = false; }

    if (!ok) {
      await repo.markTampered(c._id);
      if (owner.email) { try { await mailer.sendTamperAlert({ to: owner.email, title: c.title }); } catch (e) { logger.error('tamper alert failed:', e.message); } }
      return 'tampered';
    }

    const { token, hash } = encryption.generateToken();
    const changed = await repo.markUnlocked(c._id, { unlockedAt: t, accessTokenHash: hash, accessTokenExpiry: new Date(t.getTime() + TOKEN_TTL_MS) });
    if (!changed) return 'skipped';
    try {
      await mailer.sendUnlockEmail({ to: c.recipientEmail, ownerName: owner.name || 'Someone', title: c.title, token });
      await repo.markDelivered(c._id, t);
      return 'delivered';
    } catch (e) {
      logger.error('delivery failed, will retry next cycle:', e.message); // stays UNLOCKED
      try { await repo.release(c._id); } catch (_) { /* claim expires by itself */ }
      return 'unlocked';
    }
  }

  async function runOnce() {
    if (running) return { skipped: true };
    running = true;
    const t = now();
    const summary = { delivered: 0, tampered: 0, unlocked: 0, waiting: 0, retried: 0, errors: 0 };
    try {
      for (const c of await repo.findLocked()) {
        try { const r = await processLocked(c, t); if (summary[r] !== undefined) summary[r] += 1; }
        catch (e) { summary.errors += 1; logger.error('capsule processing error:', e.message); try { await repo.release(c._id); } catch (_) { /* stay LOCKED */ } }
      }
      for (const c of await repo.findUnlockedUndelivered()) {
        if (!(await repo.claimDelivery(c._id, t))) continue; // another run is delivering it
        try { await deliver(c, t); summary.retried += 1; }
        catch (e) { summary.errors += 1; logger.error('retry failed:', e.message); try { await repo.release(c._id); } catch (_) { /* claim expires */ } }
      }
    } finally { running = false; }
    return summary;
  }

  let task = null;
  function start(expr = '* * * * *') {
    task = cron.schedule(expr, () => { runOnce().catch((e) => logger.error('scheduler run failed:', e.message)); });
    runOnce().catch((e) => logger.error('catch-up run failed:', e.message)); // catch-up after downtime
    return task;
  }
  function stop() { if (task) task.stop(); }

  return { runOnce, start, stop };
}

module.exports = { createScheduler };
