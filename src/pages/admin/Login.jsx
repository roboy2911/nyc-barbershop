import { useState } from 'react';
import { api } from '../../lib/api.js';

// Admin sign in: email + password.
export default function Login({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const run = (fn) => async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const signIn = run(async () => {
    await api.auth.signIn(email.trim(), password);
    setPassword('');
    const ok = await onDone();
    if (ok === false) throw new Error('Signed in, but the admin page could not load your account. Please refresh and try again.');
  });

  const forgot = run(async () => {
    if (!email) throw new Error('Type your email address first.');
    await api.auth.sendReset(email.trim());
    setInfo('If that email belongs to an admin, a reset link is on its way.');
  });

  return (
    <div className="container">
      <div className="card login-box">
        <h2>Admin sign in</h2>
        {api.mode === 'demo' && (
          <div className="notice small">Demo mode: use any email and the password <strong>demo1234</strong>.</div>
        )}
        {error && <div className="error">{error}</div>}
        {info && <div className="success">{info}</div>}
        <form onSubmit={signIn}>
          <div className="field">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-pw">Password</label>
            <input id="a-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="btn-row">
            <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="btn ghost" onClick={forgot} disabled={busy}>Forgot password</button>
          </div>
        </form>
      </div>
    </div>
  );
}
