const router = require('express').Router();
const Capsule = require('../models/Capsule');
const encryption = require('../services/encryption');
const svc = require('../services/capsuleService');
const { wrap, HttpError } = require('../middleware/errorHandler');

/** Recipient opens an emailed link. Invalid/unknown/expired links all get the same generic answer. */
router.get('/access/:token', wrap(async (req, res) => {
  const cap = await Capsule.findOne({ accessTokenHash: encryption.hashToken(req.params.token) });
  const invalid = new HttpError(404, 'This link is not valid');
  if (!cap) throw invalid;
  if (cap.accessTokenExpiry && cap.accessTokenExpiry.getTime() < Date.now()) throw invalid;
  if (cap.status === 'LOCKED') throw new HttpError(403, 'This capsule is not yet available');
  if (cap.status === 'TAMPERED') throw new HttpError(409, 'This capsule is not available');
  let content = null;
  try { content = svc.readContent(cap); } catch (e) { content = null; }
  if (!content) { // integrity failure discovered at access time: never show content
    await Capsule.updateOne({ _id: cap._id }, { $set: { status: 'TAMPERED' } });
    throw new HttpError(409, 'This capsule is not available');
  }
  res.json({ title: cap.title, unlockedAt: cap.unlockedAt, integrity: { verified: true, method: 'AES-256-GCM tag + HMAC-SHA256' }, content });
}));

/** A trusted contact confirms that the life event has happened. */
router.post('/events/confirm/:token', wrap(async (req, res) => {
  const hash = encryption.hashToken(req.params.token);
  const r = await Capsule.updateOne({ eventTokenHash: hash, status: 'LOCKED', unlockMode: 'event' }, { $set: { eventConfirmed: true } });
  if (r.matchedCount === 0) throw new HttpError(404, 'This link is not valid');
  res.json({ message: 'Thank you. The event has been confirmed and the capsule will be released shortly.' });
}));

module.exports = router;
