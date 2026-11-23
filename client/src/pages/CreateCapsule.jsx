import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import CapsuleForm from './CapsuleForm.jsx';

export default function CreateCapsule() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  async function submit(body) {
    setBusy(true);
    try { const r = await api.post('/capsules', body); nav(`/capsules/${r.data.id}`); }
    catch (e) { throw new Error(errMsg(e)); }
    finally { setBusy(false); }
  }
  return (
    <>
      <div className="head"><div><h1>Seal a new capsule</h1><p className="muted">Your content is encrypted before it is stored. Even we cannot read it from the database.</p></div></div>
      <CapsuleForm onSubmit={submit} busy={busy} submitLabel="Lock capsule" />
    </>
  );
}
