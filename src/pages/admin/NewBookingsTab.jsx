import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import { BookingCard } from './parts.jsx';

const SEEN_KEY = 'nyc-admin-bookings-seen';

/* eslint-disable react-refresh/only-export-components */
export function lastSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) || '';
  } catch {
    return '';
  }
}

// The most recently made bookings, newest first. Ones made since you last
// looked are marked NEW.
export default function NewBookingsTab({ onSeen }) {
  const { data } = useShop();
  const [rows, setRows] = useState(null);
  const [seen] = useState(lastSeen);

  useEffect(() => {
    api.listRecentBookings(50).then((r) => {
      setRows(r);
      try {
        localStorage.setItem(SEEN_KEY, new Date().toISOString());
      } catch {
        /* ignore */
      }
      onSeen?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameOf = (id) => data.barbers.find((b) => b.id === id)?.name || '?';
  const when = (iso) =>
    new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div>
      <h2>Newest bookings</h2>
      <p className="muted">The last 50 bookings, in the order they were made.</p>
      {!rows && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <p className="muted">No bookings yet.</p>}
      {rows?.map((b) => (
        <div key={b.id}>
          <div className="small muted" style={{ marginBottom: 2 }}>
            Booked {b.createdAt ? when(b.createdAt) : ''} {b.source === 'online' ? 'online' : 'by the shop'}
            {seen && b.createdAt > seen && <span className="tag" style={{ background: '#1d3b22', color: '#9be3a4' }}>New</span>}
          </div>
          <BookingCard b={b} showBarber showDate nameOf={nameOf} />
        </div>
      ))}
    </div>
  );
}
