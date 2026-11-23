import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Countdown from '../components/Countdown.jsx';
import { fmtDate } from '../time.js';

const MODE = { date: 'Date', event: 'Life event', inactivity: 'Inactivity' };

export default function Dashboard() {
  const [caps, setCaps] = useState(null);
  const [stats, setStats] = useState(null);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([api.get('/capsules'), api.get('/dashboard/stats')]);
        setCaps(c.data.capsules);
        setStats(s.data);
        setOffset(new Date(c.data.serverTime).getTime() - Date.now());
      } catch (e) { setErr(errMsg(e)); }
    })();
  }, []);

  if (err) return <p className="alert err" role="alert">{err}</p>;
  if (!caps) return <p className="muted">Loading your capsules…</p>;

  const locked = caps.filter((c) => c.status === 'LOCKED');
  const history = caps.filter((c) => c.status !== 'LOCKED');
  const when = (c) => c.unlockMode === 'date' ? <Countdown target={c.unlockDate} offset={offset} />
    : c.unlockMode === 'inactivity' && c.inactivityDeadline ? <Countdown target={c.inactivityDeadline} offset={offset} />
    : <span className="muted">Waiting for “{c.eventName}”</span>;

  return (
    <>
      <div className="head">
        <div><h1>Your capsules</h1><p className="muted">Locked content is never shown here, only its details.</p></div>
        <Link className="btn" to="/create">Seal a new capsule</Link>
      </div>

      <div className="stats">
        <div className="stat"><b>{stats.total}</b><span>Total</span></div>
        <div className="stat"><b>{stats.counts.LOCKED}</b><span>Locked</span></div>
        <div className="stat"><b>{stats.counts.UNLOCKED + stats.counts.DELIVERED}</b><span>Opened</span></div>
        <div className="stat"><b>{stats.counts.TAMPERED}</b><span>Tampered</span></div>
      </div>

      <h2>Waiting to open</h2>
      {locked.length === 0 ? <p className="empty card">Nothing is sealed yet. <Link to="/create">Create your first capsule.</Link></p> : (
        <div className="list">
          {locked.map((c) => (
            <Link key={c.id} to={`/capsules/${c.id}`} className="row card">
              <div><h3>{c.title}</h3><p className="muted">{MODE[c.unlockMode]} · for {c.recipientEmail}</p></div>
              <div className="row-r"><StatusBadge status={c.status} />{when(c)}</div>
            </Link>
          ))}
        </div>
      )}

      <h2>History</h2>
      {history.length === 0 ? <p className="muted">Released capsules will appear here.</p> : (
        <div className="list">
          {history.map((c) => (
            <Link key={c.id} to={`/capsules/${c.id}`} className="row card">
              <div><h3>{c.title}</h3><p className="muted">Opened {fmtDate(c.unlockedAt)} · for {c.recipientEmail}</p></div>
              <div className="row-r"><StatusBadge status={c.status} /></div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
