import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';

export default function SettingsTab({ refreshShop }) {
  const { data } = useShop();
  const [s, setS] = useState({ ...data.settings, maxConcurrent: data.settings.maxConcurrent ?? '' });
  const [msg, setMsg] = useState({ ok: '', err: '' });

  async function save(e) {
    e.preventDefault();
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
        <button className="btn">Save settings</button>
      </form>
    </div>
  );
}
