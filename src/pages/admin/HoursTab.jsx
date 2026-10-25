import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import { DAY_NAMES, hmToMin, minToHM, minToLabel, prettyDate, qldNow } from '../../../supabase/functions/_shared/availability.js';

export default function HoursTab({ refreshShop }) {
  const { data } = useShop();
  const [weekly, setWeekly] = useState(() =>
    [1, 2, 3, 4, 5, 6, 0].map((dow) => data.weeklyHours.find((w) => w.dow === dow) || { dow, closed: true, openMin: 540, closeMin: 1020 }),
  );
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [sp, setSp] = useState({ date: '', closed: true, open: '09:00', close: '17:00', note: '' });
  const [warn, setWarn] = useState(null);

  const upd = (dow, patch) => setWeekly(weekly.map((w) => (w.dow === dow ? { ...w, ...patch } : w)));

  async function saveWeekly() {
    for (const w of weekly) {
      if (!w.closed && w.closeMin <= w.openMin) return setMsg({ ok: '', err: `${DAY_NAMES[w.dow]}: closing time must be after opening time.` });
    }
    try {
      await api.saveWeeklyHours(weekly);
      await refreshShop();
      setMsg({ ok: 'Weekly hours saved.', err: '' });
    } catch (e) {
      setMsg({ ok: '', err: e.message });
    }
  }

  async function saveSpecial(e) {
    e.preventDefault();
    const day = { date: sp.date, closed: sp.closed, openMin: sp.closed ? null : hmToMin(sp.open), closeMin: sp.closed ? null : hmToMin(sp.close), note: sp.note.trim() };
    if (!day.closed && day.closeMin <= day.openMin) return setMsg({ ok: '', err: 'Closing time must be after opening time.' });
    try {
      await api.saveSpecialDay(day);
      await refreshShop();
      // Warn about existing bookings that now fall outside the hours.
      const clash = (await api.listBookings(day.date, day.date)).filter(
        (b) => b.status === 'confirmed' && (day.closed || b.startMin < day.openMin || b.endMin > day.closeMin),
      );
      setWarn(clash.length ? { date: day.date, list: clash } : null);
      setSp({ date: '', closed: true, open: '09:00', close: '17:00', note: '' });
      setMsg({ ok: `Saved special hours for ${prettyDate(day.date)}.`, err: '' });
    } catch (err) {
      setMsg({ ok: '', err: err.message });
    }
  }

  async function removeSpecial(date) {
    if (!window.confirm(`Remove the special hours for ${prettyDate(date)}? Normal hours will apply.`)) return;
    await api.deleteSpecialDay(date);
    await refreshShop();
  }

  const today = qldNow().date;
  const upcoming = [...data.specialDays].filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <h2>Opening hours</h2>
      {msg.err && <div className="error">{msg.err}</div>}
      {msg.ok && <div className="success">{msg.ok}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Normal weekly hours</h3>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Day</th><th>Closed</th><th>Opens</th><th>Closes</th></tr></thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.dow}>
                  <td>{DAY_NAMES[w.dow]}</td>
                  <td><input type="checkbox" checked={w.closed} onChange={(e) => upd(w.dow, { closed: e.target.checked, openMin: w.openMin ?? 540, closeMin: w.closeMin ?? 1020 })} /></td>
                  <td><input type="time" step={900} disabled={w.closed} value={minToHM(w.openMin ?? 540)} onChange={(e) => e.target.value && upd(w.dow, { openMin: hmToMin(e.target.value) })} /></td>
                  <td><input type="time" step={900} disabled={w.closed} value={minToHM(w.closeMin ?? 1020)} onChange={(e) => e.target.value && upd(w.dow, { closeMin: hmToMin(e.target.value) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={saveWeekly}>Save weekly hours</button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Special days (public holidays, short-staffed days…)</h3>
        <p className="muted small">These replace the normal hours for one date. Add a note and it shows as a banner on the website in the week before.</p>
        <form onSubmit={saveSpecial}>
          <div className="grid-2">
            <div className="field">
              <label>Date</label>
              <input type="date" required min={today} value={sp.date} onChange={(e) => setSp({ ...sp, date: e.target.value })} />
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <div className="chips">
                <button type="button" className={`chip${sp.closed ? ' on' : ''}`} onClick={() => setSp({ ...sp, closed: true })}>Closed all day</button>
                <button type="button" className={`chip${!sp.closed ? ' on' : ''}`} onClick={() => setSp({ ...sp, closed: false })}>Different hours</button>
              </div>
            </div>
          </div>
          {!sp.closed && (
            <div className="grid-2">
              <div className="field"><label>Opens</label><input type="time" step={900} value={sp.open} onChange={(e) => setSp({ ...sp, open: e.target.value })} /></div>
              <div className="field"><label>Closes</label><input type="time" step={900} value={sp.close} onChange={(e) => setSp({ ...sp, close: e.target.value })} /></div>
            </div>
          )}
          <div className="field">
            <label>Note for customers (optional)</label>
            <input type="text" maxLength={140} placeholder="e.g. Closed for ANZAC Day" value={sp.note} onChange={(e) => setSp({ ...sp, note: e.target.value })} />
          </div>
          <button className="btn">Save special day</button>
        </form>

        {warn && (
          <div className="notice" style={{ marginTop: 16 }}>
            <strong>{warn.list.length} existing booking(s) on {prettyDate(warn.date)} fall outside these hours:</strong>
            <ul>
              {warn.list.map((b) => (
                <li key={b.id}>{minToLabel(b.startMin)} – {b.customerName} ({b.serviceName}) {b.phone}</li>
              ))}
            </ul>
            Go to <strong>Bookings</strong> to move or cancel them (customers with an email will be notified).
          </div>
        )}

        <h3 style={{ marginTop: 24 }}>Upcoming special days</h3>
        {upcoming.length === 0 && <p className="muted small">None.</p>}
        <div className="table-wrap">
          <table className="t">
            <tbody>
              {upcoming.map((d) => (
                <tr key={d.date}>
                  <td>{prettyDate(d.date)}</td>
                  <td>{d.closed ? 'Closed' : `${minToLabel(d.openMin)} – ${minToLabel(d.closeMin)}`}</td>
                  <td className="muted">{d.note}</td>
                  <td><button className="btn ghost sm" onClick={() => removeSpecial(d.date)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
