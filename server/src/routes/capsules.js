const router = require('express').Router();
const Capsule = require('../models/Capsule');
const User = require('../models/User');
const svc = require('../services/capsuleService');
const { authMiddleware } = require('../middleware/auth');
const { wrap, HttpError } = require('../middleware/errorHandler');

router.use(authMiddleware);

router.post('/', wrap(async (req, res) => {
  const cap = await svc.createCapsule(req.userId, req.body || {});
  const owner = await User.findById(req.userId);
  res.status(201).json(svc.toMeta(cap, owner));
}));

router.get('/', wrap(async (req, res) => {
  const owner = await User.findById(req.userId);
  const list = await Capsule.find({ ownerId: req.userId }).sort({ createdAt: -1 });
  res.json({ serverTime: new Date(), capsules: list.map((c) => svc.toMeta(c, owner)) });
}));

router.get('/:id', wrap(async (req, res) => {
  const cap = await svc.getOwned(req.userId, req.params.id);
  const owner = await User.findById(req.userId);
  const out = { serverTime: new Date(), capsule: svc.toMeta(cap, owner) };
  if (cap.status === 'UNLOCKED' || cap.status === 'DELIVERED') {
    try { out.content = svc.readContent(cap); } catch (e) { out.content = null; }
    out.integrityVerified = !!out.content;
  } // while LOCKED (or TAMPERED): metadata only, no key and no content
  res.json(out);
}));

router.put('/:id', wrap(async (req, res) => {
  const cap = await svc.updateCapsule(req.userId, req.params.id, req.body || {});
  const owner = await User.findById(req.userId);
  res.json(svc.toMeta(cap, owner));
}));

router.delete('/:id', wrap(async (req, res) => {
  const cap = await svc.getOwned(req.userId, req.params.id);
  if (cap.status !== 'LOCKED') throw new HttpError(409, 'Only a LOCKED capsule can be deleted');
  await cap.deleteOne();
  res.json({ message: 'Capsule deleted' });
}));

module.exports = router;
