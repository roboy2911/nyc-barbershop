import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { passwordProblem } from './AccountTab.jsx';

// Opened from the password-reset email. Supabase signs the user in from the
// link, then they choose a new password.
export default function ResetPassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(pw);
    if (problem) return setError(problem);
    if (pw !== pw2) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api.auth.updatePassword(pw);
      await api.auth.signOut();
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="container">
      <div className="card login-box">
        <h2>Set a new password</h2>
        {done ? (
          <>
            <div className="success">Password changed. Please sign in with your new password.</div>
            <Link className="btn" to="/admin">Go to sign in</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="error">{error}</div>}
            <div className="field">
              <label htmlFor="r1">New password</label>
              <input id="r1" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="r2">New password again</label>
              <input id="r2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <button className="btn" disabled={busy}>Save new password</button>
          </form>
        )}
      </div>
    </div>
  );
}
