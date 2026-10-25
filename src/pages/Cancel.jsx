import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { minToLabel, prettyDate } from '../../supabase/functions/_shared/availability.js';

// Opened from the "Cancel this appointment" link in the confirmation email.
export default function Cancel() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This cancel link is not valid.');
      return;
    }
    api.cancelLookup(token).then(setBooking).catch((e) => setError(e.message));
  }, [token]);

  async function doCancel() {
    setBusy(true);
    try {
      setBooking(await api.cancelByToken(token));
      setJustCancelled(true);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="page-head">
        <div className="container">
          <h1>Cancel booking</h1>
        </div>
      </div>
      <div className="container page" style={{ maxWidth: 560 }}>
        {error && <div className="error">{error}</div>}
        {!booking && !error && <p className="muted">Loading…</p>}
        {booking && (
          <div className="card">
            <h3>Your appointment</h3>
            <p>
              <strong>{booking.serviceName}</strong>
              {booking.guestName ? ` for ${booking.guestName}` : ''} with {booking.barberName}
              <br />
              {prettyDate(booking.date)} at {minToLabel(booking.startMin)}
            </p>
            {booking.status === 'cancelled' ? (
              <>
                <div className="success">
                  {justCancelled ? 'Done – your appointment has been cancelled. We have emailed you a confirmation.' : 'This appointment has been cancelled.'}
                </div>
                <Link className="btn ghost" to="/book">Book a new time</Link>
              </>
            ) : (
              <button className="btn danger" onClick={doCancel} disabled={busy}>
                {busy ? 'Cancelling…' : 'Yes, cancel this appointment'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
