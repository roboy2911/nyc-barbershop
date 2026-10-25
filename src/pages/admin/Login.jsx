import { useState } from 'react';
import { api } from '../../lib/api.js';

// Step 1: email + password. Step 2: 6-digit code from an authenticator app
// (first time: scan a QR code to set it up).
export default function Login({ onDone }) {
  const [step, setStep] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [factor, setFactor] = useState(null);
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
    const r = await api.auth.signIn(email.trim(), password);
    setPassword('');
    if (r.step === 'challenge') {
      setFactor({ factorId: r.factorId });
      setStep('code');
    } else {
      setFactor(await api.auth.enrollMfa());
      setStep('enroll');
    }
  });

  const verify = run(async () => {
    await api.auth.verifyMfa(factor.factorId, code.trim());
    onDone();
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
        {api.mode === 'demo' && step === 'password' && (
          <div className="notice small">Demo mode: use any email and the password <strong>demo1234</strong>, then any 6-digit code.</div>
        )}
        {error && <div className="error">{error}</div>}
        {info && <div className="success">{info}</div>}

        {step === 'password' && (
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
        )}

        {step === 'enroll' && (
          <form onSubmit={verify}>
            <p>Two-step security is required. Install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your phone, tap “+”, and scan this code:</p>
            {factor?.qr && (
              <div className="qr"><img src={factor.qr} alt="QR code for authenticator app" /></div>
            )}
            <p className="small muted center">Can't scan? Enter this key: <code>{factor?.secret}</code></p>
            <div className="field">
              <label htmlFor="a-code">6-digit code from the app</label>
              <input id="a-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <button className="btn" disabled={busy}>Verify &amp; continue</button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify}>
            <p>Enter the 6-digit code from your authenticator app.</p>
            <div className="field">
              <label htmlFor="a-code2">Code</label>
              <input id="a-code2" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <button className="btn" disabled={busy}>Verify</button>
          </form>
        )}
      </div>
    </div>
  );
}
