const router = require('express').Router();
const Capsule = require('../models/Capsule');
const User = require('../models/User');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const { wrap } = require('../middleware/errorHandler');

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

/** Login alone is NOT a check-in; the user must press the button. */
router.post('/checkin', authMiddleware, wrap(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { lastCheckIn: new Date() }, { new: true });
  const caps = await Capsule.find({ ownerId: req.userId, status: 'LOCKED', unlockMode: 'inactivity' });
  const DAY = 86400000;
  res.json({
    lastCheckIn: user.lastCheckIn,
    serverTime: new Date(),
    capsules: caps.map((c) => ({ id: String(c._id), title: c.title, inactivityDays: c.inactivityDays, newExpiry: new Date(user.lastCheckIn.getTime() + c.inactivityDays * DAY) })),
  });
}));

router.get('/checkin', authMiddleware, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  const caps = await Capsule.find({ ownerId: req.userId, status: 'LOCKED', unlockMode: 'inactivity' });
  const DAY = 86400000;
  res.json({
    lastCheckIn: user.lastCheckIn, serverTime: new Date(),
    capsules: caps.map((c) => ({ id: String(c._id), title: c.title, inactivityDays: c.inactivityDays, newExpiry: new Date(user.lastCheckIn.getTime() + c.inactivityDays * DAY) })),
  });
}));

router.get('/dashboard/stats', authMiddleware, wrap(async (req, res) => {
  const rows = await Capsule.aggregate([{ $match: { ownerId: new mongoose.Types.ObjectId(req.userId) } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const counts = { LOCKED: 0, UNLOCKED: 0, DELIVERED: 0, TAMPERED: 0 };
  rows.forEach((r) => { counts[r._id] = r.n; });
  res.json({ total: Object.values(counts).reduce((a, b) => a + b, 0), counts, serverTime: new Date() });
}));

module.exports = router;
