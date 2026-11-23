import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Countdown from '../components/Countdown.jsx';
import CapsuleForm from './CapsuleForm.jsx';
import { fmtDate } from '../time.js';

const MODE = { date: 'On a date', event: 'After a life event', inactivity: 'After inactivity' };

export default function CapsuleDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.get(`/capsules/${id}`);
      setData(r.data); setOffset(new Date(r.data.serverTime).getTime() - Date.now());
    } catch (e) { setErr(errMsg(e)); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function save(body) {
    setBusy(true);
    try { await api.put(`/capsules/${id}`, body); setEditing(false); await load(); }
    catch (e) { throw new Error(errMsg(e)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this capsule permanently? This cannot be undone.')) return;
    try { await api.delete(`/capsules/${id}`); nav('/'); } catch (e) { setErr(errMsg(e)); }
  }

  if (err) return <><p className="alert err" role="alert">{err}</p><Link to="/">Back to dashboard</Link></>;
  if (!data) return <p className="muted">Loading…</p>;
  const c = data.capsule;
  const locked = c.status === 'LOCKED';

  if (editing) return (<><div className="head"><h1>Edit capsule</h1><button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button></div><CapsuleForm initial={c} onSubmit={save} busy={busy} submitLabel="Save changes" /></>);

  return (
    <>
      <div className="head"><div><h1>{c.title}</h1><StatusBadge status={c.status} /></div>
        {locked && <div className="actions"><button className="btn ghost" onClick={() => setEditing(true)}>Edit</button><button className="btn danger" onClick={remove}>Delete</button></div>}</div>

      <div className="card detail">
        <dl>
          <dt>Unlock mode</dt><dd>{MODE[c.unlockMode]}</dd>
          {c.unlockMode === 'date' && <><dt>Opens on</dt><dd>{fmtDate(c.unlockDate)} (server time)</dd></>}
          {c.unlockMode === 'event' && <><dt>Life event</dt><dd>{c.eventName} {c.eventConfirmed ? '· confirmed' : '· not confirmed yet'}</dd></>}
          {c.unlockMode === 'inactivity' && <><dt>Inactivity period</dt><dd>{c.inactivityDays} days without check-in</dd></>}
          <dt>Recipient</dt><dd>{c.recipientEmail}</dd>
          <dt>Created</dt><dd>{fmtDate(c.createdAt)}</dd>
          {c.unlockedAt && <><dt>Opened</dt><dd>{fmtDate(c.unlockedAt)}</dd></>}
          {c.deliveredAt && <><dt>Emailed</dt><dd>{fmtDate(c.deliveredAt)}</dd></>}
          {locked && c.unlockMode === 'date' && <><dt>Countdown</dt><dd><Countdown target={c.unlockDate} offset={offset} /></dd></>}
          {locked && c.unlockMode === 'inactivity' && c.inactivityDeadline && <><dt>Countdown</dt><dd><Countdown target={c.inactivityDeadline} offset={offset} /></dd></>}
        </dl>
      </div>

      {locked && <p className="alert info">🔒 The content and its key are not available while the capsule is locked.</p>}
      {c.status === 'TAMPERED' && <p className="alert err" role="alert">⚠ The stored data failed its integrity check. This capsule will never be delivered.</p>}
      {data.content && (
        <div className="card content">
          <p className="alert ok">✓ Integrity verified (AES-256-GCM tag and HMAC-SHA256)</p>
          <Content content={data.content} />
        </div>
      )}
      {(c.status === 'UNLOCKED' || c.status === 'DELIVERED') && data.content === null && <p className="alert err" role="alert">The content could not be verified.</p>}
    </>
  );
}

export function Content({ content }) {
  if (content.type === 'text') return <pre className="text">{content.text}</pre>;
  const href = `data:${content.mimeType};base64,${content.data}`;
  return (
    <div>
      {content.type === 'image' && <img className="img" src={href} alt={content.fileName} />}
      <p><a className="btn ghost" href={href} download={content.fileName}>Download {content.fileName}</a></p>
    </div>
  );
}
