import { useEffect, useState } from 'react';
import api from '../api.js';
import { toLocalInput } from '../time.js';

const MAX = 5 * 1024 * 1024;

/** Shared by Create and Edit. `initial` is set when editing (content then becomes optional). */
export default function CapsuleForm({ initial, onSubmit, busy, submitLabel }) {
  const editing = !!initial;
  const [contacts, setContacts] = useState([]);
  const [f, setF] = useState({
    title: initial?.title || '', contentType: initial?.contentType || 'text', content: '', file: null,
    unlockMode: initial?.unlockMode || 'date',
    unlockDate: initial?.unlockDate ? toLocalInput(initial.unlockDate) : '',
    eventName: initial?.eventName || '', confirmerContactId: initial?.confirmerContactId || '',
    inactivityDays: initial?.inactivityDays || 30,
    recipientMode: initial?.recipientContactId ? 'contact' : 'email',
    recipientEmail: initial?.recipientEmail || '', recipientContactId: initial?.recipientContactId || '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { api.get('/contacts').then((r) => setContacts(r.data)).catch(() => {}); }, []);

  function pickFile(e) {
    const file = e.target.files[0];
    if (file && file.size > MAX) { setErr('The file is larger than 5 MB'); e.target.value = ''; return; }
    setErr(''); setF({ ...f, file });
  }
  const readB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!f.title.trim()) return setErr('Please give the capsule a title');
    const body = { title: f.title, unlockMode: f.unlockMode };
    if (f.unlockMode === 'date') {
      if (!f.unlockDate) return setErr('Choose an unlock date and time');
      if (new Date(f.unlockDate).getTime() <= Date.now()) return setErr('The unlock date must be in the future');
      body.unlockDate = new Date(f.unlockDate).toISOString();
    }
    if (f.unlockMode === 'event') {
      if (!f.eventName.trim()) return setErr('Describe the life event');
      if (!f.confirmerContactId) return setErr('Choose the trusted contact who will confirm the event (add one under Contacts)');
      body.eventName = f.eventName; body.confirmerContactId = f.confirmerContactId;
    }
    if (f.unlockMode === 'inactivity') {
      const n = Number(f.inactivityDays);
      if (!Number.isInteger(n) || n < 1) return setErr('Enter a whole number of days');
      body.inactivityDays = n;
    }
    if (f.recipientMode === 'contact') { if (!f.recipientContactId) return setErr('Choose a recipient'); body.recipientContactId = f.recipientContactId; }
    else { if (!/^\S+@\S+\.\S+$/.test(f.recipientEmail)) return setErr('Enter a valid recipient email'); body.recipientEmail = f.recipientEmail; }

    const hasNewContent = f.contentType === 'text' ? f.content.trim() : f.file;
    if (!editing && !hasNewContent) return setErr(f.contentType === 'text' ? 'Write a message' : 'Choose a file');
    if (hasNewContent) {
      body.contentType = f.contentType;
      if (f.contentType === 'text') body.content = f.content;
      else { body.fileName = f.file.name; body.mimeType = f.file.type; body.data = await readB64(f.file); }
    }
    try { await onSubmit(body); } catch (ex) { setErr(ex.message); }
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <label htmlFor="title">Title</label>
      <input id="title" value={f.title} onChange={set('title')} maxLength={120} />

      <fieldset><legend>What goes inside</legend>
        <div className="seg">
          {[['text', 'Text'], ['image', 'Image'], ['file', 'File']].map(([v, l]) => (
            <label key={v} className={f.contentType === v ? 'on' : ''}><input type="radio" name="ct" checked={f.contentType === v} onChange={() => setF({ ...f, contentType: v, file: null })} />{l}</label>
          ))}
        </div>
        {f.contentType === 'text'
          ? <textarea rows={6} value={f.content} onChange={set('content')} placeholder={editing ? 'Leave empty to keep the current content' : 'Write your message…'} aria-label="Message" />
          : <><input type="file" accept={f.contentType === 'image' ? 'image/*' : undefined} onChange={pickFile} aria-label="File" />{editing && <p className="hint">Leave empty to keep the current content.</p>}<p className="hint">Maximum 5 MB.</p></>}
      </fieldset>

      <fieldset><legend>When it opens (choose one)</legend>
        <div className="seg">
          {[['date', 'On a date'], ['event', 'After a life event'], ['inactivity', 'If I go silent']].map(([v, l]) => (
            <label key={v} className={f.unlockMode === v ? 'on' : ''}><input type="radio" name="um" checked={f.unlockMode === v} onChange={() => setF({ ...f, unlockMode: v })} />{l}</label>
          ))}
        </div>
        {f.unlockMode === 'date' && (<><label htmlFor="ud">Unlock date and time</label><input id="ud" type="datetime-local" value={f.unlockDate} onChange={set('unlockDate')} /><p className="hint">Checked against the server clock, not your device.</p></>)}
        {f.unlockMode === 'event' && (<>
          <label htmlFor="en">Life event</label><input id="en" value={f.eventName} onChange={set('eventName')} placeholder="e.g. My graduation" />
          <label htmlFor="cc">Trusted contact who confirms it</label>
          <select id="cc" value={f.confirmerContactId} onChange={set('confirmerContactId')}><option value="">Select a contact…</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}</select>
          <p className="hint">They receive an email with a confirmation link.</p></>)}
        {f.unlockMode === 'inactivity' && (<><label htmlFor="id">Release after this many days without a check-in</label><input id="id" type="number" min="1" max="3650" value={f.inactivityDays} onChange={set('inactivityDays')} /><p className="hint">Logging in does not count. You must press Check-in. You get a reminder before release.</p></>)}
      </fieldset>

      <fieldset><legend>Who receives it</legend>
        <div className="seg">
          <label className={f.recipientMode === 'email' ? 'on' : ''}><input type="radio" name="rm" checked={f.recipientMode === 'email'} onChange={() => setF({ ...f, recipientMode: 'email' })} />Email address</label>
          <label className={f.recipientMode === 'contact' ? 'on' : ''}><input type="radio" name="rm" checked={f.recipientMode === 'contact'} onChange={() => setF({ ...f, recipientMode: 'contact' })} />Trusted contact</label>
        </div>
        {f.recipientMode === 'email'
          ? <input type="email" value={f.recipientEmail} onChange={set('recipientEmail')} placeholder="name@example.com" aria-label="Recipient email" />
          : <select value={f.recipientContactId} onChange={set('recipientContactId')} aria-label="Recipient contact"><option value="">Select a contact…</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}</select>}
      </fieldset>

      {err && <p className="alert err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Encrypting and saving…' : submitLabel}</button>
    </form>
  );
}
