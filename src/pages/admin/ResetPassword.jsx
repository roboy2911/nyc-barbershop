import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { passwordProblem } from './AccountTab.jsx';

// Opened from the password-reset email. Supabase signs the user in from the
// link; because 2FA is on, they must also enter their app code before the
// new password is accepted.
export default function ResetPassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (api.mode !== 'live') return;
    api.auth.factorForReset?.().then(setFactorId).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(pw);
    if (problem) return setError(problem);
    if (pw !== pw2) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      if (factorId) await api.auth.verifyMfa(factorId, code.trim());
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
            {factorId && (
              <div className="field">
                <label htmlFor="r3">6-digit code from your authenticator app</label>
                <input id="r3" type="text" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
            )}
            <button className="btn" disabled={busy}>Save new password</button>
          </form>
        )}
      </div>
    </div>
  );
}
