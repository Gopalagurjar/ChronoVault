import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';

const blank = { name: '', email: '', relation: '' };

export default function Contacts() {
  const [list, setList] = useState(null);
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = () => api.get('/contacts').then((r) => setList(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!f.name.trim()) return setErr('Name is required');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter a valid email');
    try { editId ? await api.put(`/contacts/${editId}`, f) : await api.post('/contacts', f); setF(blank); setEditId(null); load(); }
    catch (ex) { setErr(errMsg(ex)); }
  }
  async function del(c) {
    if (!window.confirm(`Delete ${c.name}? Capsules already addressed to this email keep their recipient.`)) return;
    try { await api.delete(`/contacts/${c.id}`); load(); } catch (ex) { setErr(errMsg(ex)); }
  }

  return (
    <>
      <div className="head"><div><h1>Trusted contacts</h1><p className="muted">People who can receive a capsule or confirm a life event for you.</p></div></div>
      <form className="card form inline" onSubmit={submit} noValidate>
        <div><label htmlFor="cn">Name</label><input id="cn" value={f.name} onChange={set('name')} /></div>
        <div><label htmlFor="ce">Email</label><input id="ce" type="email" value={f.email} onChange={set('email')} /></div>
        <div><label htmlFor="cr">Relation (optional)</label><input id="cr" value={f.relation} onChange={set('relation')} /></div>
        <div className="actions"><button className="btn">{editId ? 'Save' : 'Add contact'}</button>{editId && <button type="button" className="btn ghost" onClick={() => { setEditId(null); setF(blank); }}>Cancel</button>}</div>
      </form>
      {err && <p className="alert err" role="alert">{err}</p>}
      {!list ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="empty card">No contacts yet.</p> : (
        <div className="list">{list.map((c) => (
          <div key={c.id} className="row card"><div><h3>{c.name}</h3><p className="muted">{c.email}{c.relation ? ` · ${c.relation}` : ''}</p></div>
            <div className="actions"><button className="btn ghost sm" onClick={() => { setEditId(c.id); setF({ name: c.name, email: c.email, relation: c.relation }); window.scrollTo(0, 0); }}>Edit</button><button className="btn danger sm" onClick={() => del(c)}>Delete</button></div></div>
        ))}</div>
      )}
    </>
  );
}
