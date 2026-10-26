import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';

export default function SettingsTab({ refreshShop }) {
  const { data } = useShop();
  const [s, setS] = useState({ ...data.settings, maxConcurrent: data.settings.maxConcurrent ?? '' });
  const [msg, setMsg] = useState({ ok: '', err: '' });

  async function backup() {
    try {
      const all = await api.exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(all, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `nyc-barbershop-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setMsg({ ok: '', err: `Backup failed: ${err.message}` });
    }
  }

  async function save(e) {
    e.preventDefault();
    if (s.googleReviewUrl && !/^https:\/\//.test(s.googleReviewUrl.trim())) return setMsg({ ok: '', err: 'The Google review link should start with https://' });
    try {
      await api.saveSettings({
        ...s,
        maxConcurrent: s.maxConcurrent === '' ? null : Math.max(1, Number(s.maxConcurrent)),
        bookingWindowDays: Number(s.bookingWindowDays),
        cutoffMinutes: Number(s.cutoffMinutes),
        slotStep: Number(s.slotStep),
      });
      await refreshShop();
      setMsg({ ok: 'Settings saved.', err: '' });
    } catch (err) {
      setMsg({ ok: '', err: err.message });
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>Settings</h2>
      {msg.err && <div className="error">{msg.err}</div>}
      {msg.ok && <div className="success">{msg.ok}</div>}
      <form className="card" onSubmit={save}>
        <h3>Bookings</h3>
        <div className="field">
          <label>Most bookings at the same time</label>
          <select value={s.maxConcurrent} onChange={(e) => setS({ ...s, maxConcurrent: e.target.value })}>
            <option value="">Automatic – one per working barber</option>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <p className="muted small">Automatic means 2 barbers working = 2 bookings at once, 3 barbers = 3, and so on. Choose a number to set a lower limit.</p>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>How far ahead customers can book (days)</label>
            <input type="number" min={1} max={365} value={s.bookingWindowDays} onChange={(e) => setS({ ...s, bookingWindowDays: e.target.value })} />
          </div>
          <div className="field">
            <label>Stop online bookings this many minutes before</label>
            <input type="number" min={0} max={1440} step={5} value={s.cutoffMinutes} onChange={(e) => setS({ ...s, cutoffMinutes: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Time steps on the booking page</label>
          <select value={s.slotStep} onChange={(e) => setS({ ...s, slotStep: e.target.value })}>
            {[5, 10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>Every {n} minutes</option>)}
          </select>
        </div>

        <h3 style={{ marginTop: 20 }}>Shop details</h3>
        <div className="grid-2">
          <div className="field">
            <label>Phone shown on website</label>
            <input type="tel" value={s.phone || ''} onChange={(e) => setS({ ...s, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Email shown on website</label>
            <input type="email" value={s.publicEmail || ''} onChange={(e) => setS({ ...s, publicEmail: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Website banner (optional – shows at the top of every page)</label>
          <input type="text" maxLength={160} placeholder="e.g. Now open late Thursdays until 9pm!" value={s.banner || ''} onChange={(e) => setS({ ...s, banner: e.target.value })} />
        </div>
        <h3 style={{ marginTop: 20 }}>Google reviews</h3>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
          <input type="checkbox" style={{ marginTop: 4 }} checked={s.reviewRequests ?? true} onChange={(e) => setS({ ...s, reviewRequests: e.target.checked })} />
          <span>
            Email customers a “How was your cut?” review request the day after their appointment
            <span className="small muted" style={{ display: 'block' }}>Sent between 9am and 7pm, at most once every 90 days per customer, never after a no-show. Customers can unsubscribe. Starts once emails are set up.</span>
          </span>
        </label>
        <div className="field">
          <label>Google review link</label>
          <input type="url" placeholder="https://g.page/r/…/review" value={s.googleReviewUrl || ''} onChange={(e) => setS({ ...s, googleReviewUrl: e.target.value })} />
          <p className="muted small">Used by the review email and the “Review us on Google” buttons. For a link that opens the review box directly: Google Business Profile → “Ask for reviews” → copy link.</p>
        </div>
        <button className="btn">Save settings</button>
      </form>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Backup</h3>
        <p className="muted small">
          A password-protected backup of everything (bookings, customers, hours, settings) is made automatically every week.
          You can also download one now – keep it somewhere private, it contains customer details.
        </p>
        <button className="btn ghost" onClick={backup}>Download backup now</button>
      </div>
    </div>
  );
}
