const mongoose = require('mongoose');
const Capsule = require('../models/Capsule');
const TrustedContact = require('../models/TrustedContact');
const User = require('../models/User');
const encryption = require('./encryption');
const mailer = require('./mailer');
const { HttpError } = require('../middleware/errorHandler');
const { isEmail, isStr } = require('../utils/validate');
const { inactivityDeadline } = require('./evaluators');

const MAX_BYTES = 5 * 1024 * 1024; // content limit: 5 MB

/** Turn the request body into the plaintext Buffer that gets encrypted (metadata of a file is encrypted too). */
function buildPlaintext(body) {
  const type = body.contentType || 'text';
  if (!['text', 'image', 'file'].includes(type)) throw new HttpError(400, 'Invalid content type');
  let envelope;
  let size;
  if (type === 'text') {
    if (!isStr(body.content, 1, MAX_BYTES)) throw new HttpError(400, 'Message text is required');
    size = Buffer.byteLength(body.content, 'utf8');
    envelope = { type, text: body.content };
  } else {
    if (!isStr(body.data, 1, MAX_BYTES * 2) || !isStr(body.fileName, 1, 200)) throw new HttpError(400, 'A file is required');
    const raw = Buffer.from(body.data, 'base64');
    size = raw.length;
    if (type === 'image' && !/^image\//.test(body.mimeType || '')) throw new HttpError(400, 'Selected file is not an image');
    envelope = { type, fileName: body.fileName, mimeType: String(body.mimeType || 'application/octet-stream'), data: body.data };
  }
  if (size > MAX_BYTES) throw new HttpError(413, 'Content is too large (limit 5 MB)');
  return { type, plain: Buffer.from(JSON.stringify(envelope), 'utf8') };
}

async function resolveRecipient(userId, body) {
  if (body.recipientContactId) {
    const c = await TrustedContact.findOne({ _id: body.recipientContactId, userId });
    if (!c) throw new HttpError(400, 'Recipient contact not found');
    return { recipientEmail: c.email, recipientContactId: c._id };
  }
  if (!isEmail(body.recipientEmail)) throw new HttpError(400, 'A valid recipient email is required');
  return { recipientEmail: body.recipientEmail.trim().toLowerCase() };
}

/** Exactly one unlock mode; validated server-side. */
async function buildCondition(userId, body, now = new Date()) {
  const mode = body.unlockMode;
  if (mode === 'date') {
    const d = new Date(body.unlockDate);
    if (!body.unlockDate || isNaN(d.getTime())) throw new HttpError(400, 'A valid unlock date is required');
    if (d.getTime() <= now.getTime()) throw new HttpError(400, 'Unlock date must be in the future');
    return { unlockMode: 'date', unlockDate: d };
  }
  if (mode === 'event') {
    if (!isStr(body.eventName, 2, 120)) throw new HttpError(400, 'Describe the life event');
    const c = await TrustedContact.findOne({ _id: body.confirmerContactId, userId });
    if (!c) throw new HttpError(400, 'Choose a trusted contact who will confirm the event');
    return { unlockMode: 'event', eventName: body.eventName.trim(), confirmerContactId: c._id };
  }
  if (mode === 'inactivity') {
    const n = Number(body.inactivityDays);
    if (!Number.isInteger(n) || n < 1 || n > 3650) throw new HttpError(400, 'Inactivity period must be 1 to 3650 days');
    return { unlockMode: 'inactivity', inactivityDays: n };
  }
  throw new HttpError(400, 'Choose exactly one unlock mode: date, event or inactivity');
}

/** API view: metadata only, never keys, ciphertext, IV, tag, hash or token hashes. */
function toMeta(c, owner) {
  const o = c.toObject ? c.toObject() : c;
  const meta = {
    id: String(o._id), title: o.title, contentType: o.contentType, status: o.status, unlockMode: o.unlockMode,
    unlockDate: o.unlockDate, eventName: o.eventName, eventConfirmed: o.eventConfirmed, inactivityDays: o.inactivityDays,
    recipientEmail: o.recipientEmail, recipientContactId: o.recipientContactId, confirmerContactId: o.confirmerContactId,
    createdAt: o.createdAt, unlockedAt: o.unlockedAt, deliveredAt: o.deliveredAt,
  };
  if (o.unlockMode === 'inactivity' && owner) {
    const dl = inactivityDeadline(o, owner.lastCheckIn);
    meta.inactivityDeadline = dl;
  }
  return meta;
}

async function sendConfirmRequest(userId, capsuleDoc, contact) {
  const { token, hash } = encryption.generateToken();
  capsuleDoc.eventTokenHash = hash;
  await capsuleDoc.save();
  const owner = await User.findById(userId);
  try {
    await mailer.sendEventConfirmRequest({ to: contact.email, contactName: contact.name, ownerName: owner.name, eventName: capsuleDoc.eventName, token });
  } catch (e) { console.error('confirm request email failed:', e.message); }
}

async function createCapsule(userId, body) {
  if (!isStr(body.title, 1, 120)) throw new HttpError(400, 'Title is required (max 120 characters)');
  const { type, plain } = buildPlaintext(body);
  const cond = await buildCondition(userId, body);
  const recipient = await resolveRecipient(userId, body);
  const enc = encryption.encrypt(plain); // plaintext and DEK are not stored
  plain.fill(0);
  const cap = await Capsule.create({ ownerId: userId, title: body.title.trim(), contentType: type, ...enc, ...cond, ...recipient, status: 'LOCKED' });
  if (cond.unlockMode === 'event') {
    const contact = await TrustedContact.findById(cond.confirmerContactId);
    await sendConfirmRequest(userId, cap, contact);
  }
  return cap;
}

async function getOwned(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Capsule not found');
  const cap = await Capsule.findById(id);
  if (!cap) throw new HttpError(404, 'Capsule not found');
  if (String(cap.ownerId) !== String(userId)) throw new HttpError(403, 'You do not have access to this capsule');
  return cap;
}

async function updateCapsule(userId, id, body) {
  const cap = await getOwned(userId, id);
  if (cap.status !== 'LOCKED') throw new HttpError(409, 'Only a LOCKED capsule can be edited');
  if (body.title !== undefined) { if (!isStr(body.title, 1, 120)) throw new HttpError(400, 'Invalid title'); cap.title = body.title.trim(); }
  if (body.recipientEmail !== undefined || body.recipientContactId !== undefined) Object.assign(cap, await resolveRecipient(userId, body));
  if (body.unlockMode !== undefined) {
    const cond = await buildCondition(userId, body);
    cap.set({ unlockDate: undefined, eventName: undefined, confirmerContactId: undefined, inactivityDays: undefined, eventConfirmed: false, eventTokenHash: undefined });
    cap.set(cond);
  }
  if (body.content !== undefined || body.data !== undefined) { // re-encrypt with a new key and a new IV
    const { type, plain } = buildPlaintext(body);
    Object.assign(cap, encryption.encrypt(plain), { contentType: type });
    plain.fill(0);
  }
  await cap.save();
  if (cap.unlockMode === 'event' && body.unlockMode === 'event') {
    const contact = await TrustedContact.findById(cap.confirmerContactId);
    await sendConfirmRequest(userId, cap, contact);
  }
  return cap;
}

/** Content is only ever returned to the owner after the capsule has been released. */
function readContent(cap) {
  const { plain, ok } = encryption.decryptAndVerify(cap);
  if (!ok) return null;
  const env = JSON.parse(plain.toString('utf8'));
  plain.fill(0);
  return env.type === 'text'
    ? { type: 'text', text: env.text }
    : { type: env.type, fileName: env.fileName, mimeType: env.mimeType, data: env.data };
}

module.exports = { createCapsule, updateCapsule, getOwned, toMeta, readContent, buildCondition, buildPlaintext, MAX_BYTES };
