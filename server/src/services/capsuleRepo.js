/** Mongoose-backed repository used by the scheduler. Keeping DB calls here makes the scheduler unit-testable. */
const Capsule = require('../models/Capsule');
const CLAIM_TTL_MS = 5 * 60 * 1000;

module.exports = {
  /** LOCKED capsules with the owner's email / name / lastCheckIn attached as `owner`. */
  async findLocked() {
    const list = await Capsule.find({ status: 'LOCKED' }).populate('ownerId', 'name email lastCheckIn').lean();
    return list.map((c) => ({ ...c, owner: c.ownerId, ownerId: c.ownerId && c.ownerId._id }));
  },
  async findUnlockedUndelivered() {
    const list = await Capsule.find({ status: 'UNLOCKED', deliveredAt: null }).populate('ownerId', 'name email').lean();
    return list.map((c) => ({ ...c, owner: c.ownerId, ownerId: c.ownerId && c.ownerId._id }));
  },
  /** Atomic claim: only one scheduler run can win a given LOCKED capsule (at-most-once). */
  async claim(id, now) {
    const stale = new Date(now.getTime() - CLAIM_TTL_MS);
    const r = await Capsule.findOneAndUpdate(
      { _id: id, status: 'LOCKED', $or: [{ processingAt: null }, { processingAt: { $lt: stale } }] },
      { $set: { processingAt: now } }
    );
    return !!r;
  },
  /** Atomic claim of an UNLOCKED capsule for (re)delivery, so a retry cannot overlap another run's e-mail. */
  async claimDelivery(id, now) {
    const stale = new Date(now.getTime() - CLAIM_TTL_MS);
    const r = await Capsule.findOneAndUpdate(
      { _id: id, status: 'UNLOCKED', deliveredAt: null, $or: [{ processingAt: null }, { processingAt: { $lt: stale } }] },
      { $set: { processingAt: now } }
    );
    return !!r;
  },
  async release(id) { await Capsule.updateOne({ _id: id, status: { $in: ['LOCKED', 'UNLOCKED'] } }, { $set: { processingAt: null } }); },
  async markUnlocked(id, { unlockedAt, accessTokenHash, accessTokenExpiry }) {
    const r = await Capsule.updateOne(
      { _id: id, status: 'LOCKED' },
      { $set: { status: 'UNLOCKED', unlockedAt, accessTokenHash, accessTokenExpiry } } // claim is kept until delivery ends
    );
    return r.modifiedCount === 1;
  },
  async setToken(id, { accessTokenHash, accessTokenExpiry }) {
    await Capsule.updateOne({ _id: id, status: 'UNLOCKED' }, { $set: { accessTokenHash, accessTokenExpiry } });
  },
  async markDelivered(id, now) { await Capsule.updateOne({ _id: id, status: 'UNLOCKED' }, { $set: { status: 'DELIVERED', deliveredAt: now, processingAt: null } }); },
  async markTampered(id) { await Capsule.updateOne({ _id: id }, { $set: { status: 'TAMPERED', processingAt: null } }); },
  async markReminderSent(id, now) { await Capsule.updateOne({ _id: id }, { $set: { reminderSentAt: now } }); },
};
