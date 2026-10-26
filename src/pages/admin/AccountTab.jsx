import { useState } from 'react';
import { api } from '../../lib/api.js';

// eslint-disable-next-line react-refresh/only-export-components
export function passwordProblem(pw) {
  if (pw.length < 12) return 'Use at least 12 characters.';
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return 'Use a mix of letters and numbers.';
  return '';
}

export default function AccountTab({ admin }) {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const problem = passwordProblem(pw);
    if (problem) return setMsg({ ok: '', err: problem });
    if (pw !== pw2) return setMsg({ ok: '', err: 'The two new passwords do not match.' });
    setBusy(true);
    try {
      await api.auth.changePassword(current, pw);
      setMsg({ ok: 'Password changed.', err: '' });
      setCurrent('');
      setPw('');
      setPw2('');
    } catch (err) {
      setMsg({ ok: '', err: err.message });
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h2>Account &amp; password</h2>
      <p className="muted">Signed in as <strong>{admin.email}</strong>. You'll stay signed in on this device, and be signed out automatically after 12 hours of no use. Use a strong password that you don't use anywhere else.</p>
      <div className="card">
        <h3>Change password</h3>
        {msg.err && <div className="error">{msg.err}</div>}
        {msg.ok && <div className="success">{msg.ok}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="p0">Current password</label>
            <input id="p0" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="p1">New password (12+ characters, letters and numbers)</label>
            <input id="p1" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="p2">New password again</label>
            <input id="p2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>Change password</button>
        </form>
      </div>
    </div>
  );
}
