const router = require('express').Router();
const TrustedContact = require('../models/TrustedContact');
const Capsule = require('../models/Capsule');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const { wrap, HttpError } = require('../middleware/errorHandler');
const { isEmail, isStr } = require('../utils/validate');

router.use(authMiddleware);
const view = (c) => ({ id: String(c._id), name: c.name, email: c.email, relation: c.relation || '' });

function check(b) {
  if (!isStr(b.name, 1, 80)) throw new HttpError(400, 'Name is required');
  if (!isEmail(b.email)) throw new HttpError(400, 'A valid email is required');
  if (b.relation && !isStr(b.relation, 1, 40)) throw new HttpError(400, 'Relation is too long');
}
async function own(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Contact not found');
  const c = await TrustedContact.findById(id);
  if (!c) throw new HttpError(404, 'Contact not found');
  if (String(c.userId) !== String(userId)) throw new HttpError(403, 'You do not have access to this contact');
  return c;
}

router.get('/', wrap(async (req, res) => res.json((await TrustedContact.find({ userId: req.userId }).sort({ name: 1 })).map(view))));

router.post('/', wrap(async (req, res) => {
  check(req.body || {});
  const email = req.body.email.trim().toLowerCase();
  if (await TrustedContact.findOne({ userId: req.userId, email })) throw new HttpError(409, 'You already have a contact with this email');
  const c = await TrustedContact.create({ userId: req.userId, name: req.body.name.trim(), email, relation: (req.body.relation || '').trim() });
  res.status(201).json(view(c));
}));

router.put('/:id', wrap(async (req, res) => {
  const c = await own(req.userId, req.params.id);
  check(req.body || {});
  const email = req.body.email.trim().toLowerCase();
  const dup = await TrustedContact.findOne({ userId: req.userId, email, _id: { $ne: c._id } });
  if (dup) throw new HttpError(409, 'You already have a contact with this email');
  Object.assign(c, { name: req.body.name.trim(), email, relation: (req.body.relation || '').trim() });
  await c.save();
  res.json(view(c));
}));

router.delete('/:id', wrap(async (req, res) => {
  const c = await own(req.userId, req.params.id);
  const inUse = await Capsule.countDocuments({ ownerId: req.userId, status: 'LOCKED', confirmerContactId: c._id });
  if (inUse) throw new HttpError(409, 'This contact confirms an event for a locked capsule. Change that capsule first.');
  await c.deleteOne(); // existing capsules keep their recipientEmail snapshot
  res.json({ message: 'Contact deleted' });
}));

module.exports = router;
