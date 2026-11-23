import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { fmtDate } from '../time.js';

export default function CheckIn() {
  const [info, setInfo] = useState(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/checkin').then((r) => setInfo(r.data)).catch((e) => setErr(errMsg(e))); }, []);

  async function press() {
    setBusy(true); setErr('');
    try { const r = await api.post('/checkin'); setInfo(r.data); setDone(true); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  if (err && !info) return <p className="alert err" role="alert">{err}</p>;
  if (!info) return <p className="muted">Loading…</p>;
  return (
    <>
      <div className="head"><div><h1>Check-in</h1><p className="muted">Confirm that you are active. This restarts the countdown of every inactivity capsule. Logging in alone does not count.</p></div></div>
      <div className="card center">
        {done && <p className="alert ok" role="status">✓ Check-in recorded.</p>}
        <p>Last check-in: <b>{fmtDate(info.lastCheckIn)}</b></p>
        <button className="btn big" onClick={press} disabled={busy}>{busy ? 'Saving…' : 'I am here, check in'}</button>
        {err && <p className="alert err" role="alert">{err}</p>}
      </div>
      <h2>Inactivity capsules</h2>
      {info.capsules.length === 0 ? <p className="muted">You have no locked inactivity capsules.</p> : (
        <div className="list">{info.capsules.map((c) => (
          <div key={c.id} className="row card"><div><h3>{c.title}</h3><p className="muted">Released after {c.inactivityDays} days without a check-in</p></div><div className="row-r"><span className="muted">Release date if you stay silent</span><b>{fmtDate(c.newExpiry)}</b></div></div>
        ))}</div>
      )}
    </>
  );
}
