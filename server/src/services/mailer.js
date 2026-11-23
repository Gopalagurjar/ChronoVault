const nodemailer = require('nodemailer');

let transport;
function getTransport() {
  if (transport) return transport;
  if (process.env.SMTP_HOST) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else {
    // Development fallback: emails are printed to the console instead of being sent.
    transport = nodemailer.createTransport({ jsonTransport: true });
  }
  return transport;
}

const from = () => process.env.MAIL_FROM || 'ChronoVault <noreply@chronovault.app>';
const origin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function send(message) {
  const info = await getTransport().sendMail({ from: from(), ...message });
  if (!process.env.SMTP_HOST) console.log(`[mail:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
  return info;
}

const shell = (title, body) => `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:24px;color:#14202b">
<h2 style="margin:0 0 12px">ChronoVault</h2><h3 style="margin:0 0 16px">${title}</h3>${body}
<p style="color:#6b7280;font-size:12px;margin-top:28px">If you were not expecting this message you can ignore it.</p></div>`;

/** The email carries an unguessable link, never the content itself. */
function sendUnlockEmail({ to, ownerName, title, token }) {
  const link = `${origin()}/access/${token}`;
  return send({
    to,
    subject: `A ChronoVault capsule from ${ownerName} is ready for you`,
    text: `${ownerName} locked a capsule ("${title}") for you and it is now open.\nOpen it here: ${link}`,
    html: shell('A capsule is ready for you', `<p>${esc(ownerName)} locked a capsule titled <b>${esc(title)}</b> for you. It is now unlocked.</p><p><a href="${link}" style="background:#1f5c4d;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open the capsule</a></p><p style="font-size:12px;word-break:break-all">${link}</p>`),
  });
}

function sendTamperAlert({ to, title }) {
  return send({
    to,
    subject: 'ChronoVault: integrity check failed for one of your capsules',
    text: `The integrity check failed for your capsule "${title}". It was marked TAMPERED and has NOT been delivered.`,
    html: shell('Integrity check failed', `<p>The capsule <b>${esc(title)}</b> failed its integrity check, so it was marked <b>TAMPERED</b> and was <b>not</b> delivered.</p>`),
  });
}

function sendCheckInReminder({ to, title, deadline }) {
  const when = new Date(deadline).toUTCString();
  return send({
    to,
    subject: 'ChronoVault: please check in',
    text: `Your inactivity capsule "${title}" will be released on ${when} unless you check in. Open ${origin()}/checkin and press Check in.`,
    html: shell('Please check in', `<p>Your capsule <b>${esc(title)}</b> will be released on <b>${esc(when)}</b> unless you check in.</p><p><a href="${origin()}/checkin">Go to Check-in</a></p>`),
  });
}

function sendEventConfirmRequest({ to, contactName, ownerName, eventName, token }) {
  const link = `${origin()}/confirm/${token}`;
  return send({
    to,
    subject: `${ownerName} named you as a trusted contact on ChronoVault`,
    text: `Hello ${contactName}, ${ownerName} asked you to confirm the event "${eventName}" if it happens.\nOnly use this link if the event has really occurred: ${link}`,
    html: shell('You are a trusted contact', `<p>Hello ${esc(contactName)}, ${esc(ownerName)} asked you to confirm the event <b>${esc(eventName)}</b> if and when it happens.</p><p>Only use this link if the event has really occurred:</p><p><a href="${link}">${link}</a></p>`),
  });
}

module.exports = { sendUnlockEmail, sendTamperAlert, sendCheckInReminder, sendEventConfirmRequest };
