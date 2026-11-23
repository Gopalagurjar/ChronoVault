const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError, wrap } = require('../middleware/errorHandler');
const { isEmail, isStr } = require('../utils/validate');

const sign = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, lastCheckIn: u.lastCheckIn });

router.post('/register', wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!isStr(name, 1, 80)) throw new HttpError(400, 'Name is required');
  if (!isEmail(email)) throw new HttpError(400, 'A valid email is required');
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (password.length > 128) throw new HttpError(400, 'Password is too long');
  if (await User.findOne({ email: email.trim().toLowerCase() })) throw new HttpError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const fail = () => new HttpError(401, 'Invalid email or password'); // generic: does not reveal which one was wrong
  if (!isEmail(email) || typeof password !== 'string') throw fail();
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw fail();
  res.json({ token: sign(user), user: publicUser(user) });
}));

module.exports = router;