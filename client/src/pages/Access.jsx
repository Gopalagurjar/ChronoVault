import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api.js';
import { Content } from './CapsuleDetails.jsx';
import { fmtDate } from '../time.js';

/** Public page opened from the emailed link. */
export default function Access() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    api.get(`/access/${token}`)
      .then((r) => setState({ data: r.data }))
      .catch((e) => setState({ error: e.response?.data?.message || 'This link is not valid' }));
  }, [token]);

  return (
    <div className="public">
      <div className="brand center-brand">ChronoVault</div>
      {state.loading && <p className="muted">Opening…</p>}
      {state.error && <div className="card"><h2>Capsule unavailable</h2><p>{state.error}</p></div>}
      {state.data && (
        <div className="card">
          <h1>{state.data.title}</h1>
          <p className="muted">Unlocked {fmtDate(state.data.unlockedAt)}</p>
          <p className="alert ok">✓ Integrity check passed ({state.data.integrity.method})</p>
          <Content content={state.data.content} />
        </div>
      )}
    </div>
  );
}
