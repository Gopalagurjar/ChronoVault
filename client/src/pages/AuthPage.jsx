import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api.js';

export default function AuthPage({ mode }) {
  const { login, register } = useAuth();
  const isLogin = mode === 'login';
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!isLogin && f.password.length < 8) return setErr('Password must be at least 8 characters');
    setBusy(true);
    try { isLogin ? await login(f.email, f.password) : await register(f.name, f.email, f.password); }
    catch (ex) { setErr(errMsg(ex)); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <h1>Say it once.<br />Open it when it matters.</h1>
        <p>ChronoVault seals your words, photos and files inside an encrypted capsule. It stays shut until the date you chose, a moment a trusted person confirms, or a long silence.</p>
        <ul>
          <li>AES-256-GCM encryption, one key per capsule</li>
          <li>Date, life event or inactivity unlock</li>
          <li>Tamper check before anything is delivered</li>
        </ul>
      </section>
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
        {!isLogin && (<><label htmlFor="name">Full name</label><input id="name" value={f.name} onChange={set('name')} required autoComplete="name" /></>)}
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" value={f.password} onChange={set('password')} required autoComplete={isLogin ? 'current-password' : 'new-password'} />
        {!isLogin && <p className="hint">At least 8 characters.</p>}
        {err && <p className="alert err" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Register'}</button>
        <p className="switch">{isLogin ? <>New here? <Link to="/register">Create an account</Link></> : <>Already registered? <Link to="/login">Log in</Link></>}</p>
      </form>
    </div>
  );
}
