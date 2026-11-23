import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { errMsg } from '../api.js';

/** Public page where a trusted contact confirms a life event. */
export default function Confirm() {
  const { token } = useParams();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true); setErr('');
    try { setMsg((await api.post(`/events/confirm/${token}`)).data.message); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="public">
      <div className="brand center-brand">ChronoVault</div>
      <div className="card">
        <h1>Confirm a life event</h1>
        {msg ? <p className="alert ok" role="status">{msg}</p> : (<>
          <p>Someone named you as a trusted contact. Press the button <b>only if</b> the event they described has really happened. Confirming releases their capsule to the recipient.</p>
          {err && <p className="alert err" role="alert">{err}</p>}
          <button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Confirming…' : 'Yes, the event has happened'}</button>
        </>)}
      </div>
    </div>
  );
}
