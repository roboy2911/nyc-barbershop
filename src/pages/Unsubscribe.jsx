import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

// Opened from the "Unsubscribe" link in review-request emails.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('ask');
  const [error, setError] = useState('');

  async function confirm() {
    setState('busy');
    try {
      await api.unsubscribe(token);
      setState('done');
    } catch (e) {
      setError(e.message);
      setState('ask');
    }
  }

  return (
    <>
      <div className="page-head"><div className="container"><h1>Email preferences</h1></div></div>
      <div className="container page" style={{ maxWidth: 560 }}>
        <div className="card">
          {error && <div className="error">{error}</div>}
          {state === 'done' ? (
            <>
              <div className="success">Done – you won't get “How was your cut?” emails from us any more.</div>
              <p className="muted small">You'll still get booking confirmations and reminders when you book.</p>
              <Link className="btn ghost" to="/">Back to home</Link>
            </>
          ) : (
            <>
              <p>Stop receiving “How was your cut?” review emails from NYC Barbershop?</p>
              <p className="muted small">Booking confirmations and reminders will still be sent when you make a booking.</p>
              <button className="btn" disabled={!token || state === 'busy'} onClick={confirm}>
                {state === 'busy' ? 'Saving…' : 'Yes, unsubscribe me'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
