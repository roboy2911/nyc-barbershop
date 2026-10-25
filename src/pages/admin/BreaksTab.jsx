import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import { DAY_NAMES, activeBarbers, hmToMin, minToLabel, prettyDate, qldNow } from '../../../supabase/functions/_shared/availability.js';

const describe = (b) => {
  if (b.repeat === 'none') return `One-off on ${prettyDate(b.startDate, { weekday: 'short', day: 'numeric', month: 'short' })}`;
  const until = b.repeatUntil ? ` until ${prettyDate(b.repeatUntil, { day: 'numeric', month: 'short', year: 'numeric' })}` : ' (no end date)';
  const from = ` from ${prettyDate(b.startDate, { day: 'numeric', month: 'short' })}`;
  if (b.repeat === 'daily') return `Every day${from}${until}`;
  return `Every ${b.repeatDays.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')}${from}${until}`;
};

export default function BreaksTab({ refreshShop }) {
  const { data } = useShop();
  const barbers = activeBarbers(data);
  const today = qldNow().date;
  const [f, setF] = useState({ barberId: barbers[0]?.id, startDate: today, start: '12:00', end: '12:30', repeat: 'none', repeatDays: [], repeatUntil: '', label: 'Lunch' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function add(e) {
    e.preventDefault();
    const startMin = hmToMin(f.start);
    const endMin = hmToMin(f.end);
    if (endMin <= startMin) return setError('The break must end after it starts.');
    if (f.repeat === 'weekly' && !f.repeatDays.length) return setError('Pick at least one day of the week.');
    if (f.repeatUntil && f.repeatUntil < f.startDate) return setError('"Repeat until" is before the start date.');
    try {
      await api.addBreak({ barberId: f.barberId, startDate: f.startDate, startMin, endMin, repeat: f.repeat, repeatDays: f.repeat === 'weekly' ? f.repeatDays : [], repeatUntil: f.repeat === 'none' ? null : f.repeatUntil || null, label: f.label.trim() });
      await refreshShop();
      setError('');
      setOk('Break added. Those times are now blocked on the booking page.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this break?')) return;
    await api.deleteBreak(id);
    await refreshShop();
  }

  const toggleDay = (d) => setF({ ...f, repeatDays: f.repeatDays.includes(d) ? f.repeatDays.filter((x) => x !== d) : [...f.repeatDays, d].sort() });
  const current = data.breaks.filter((b) => (b.repeat === 'none' ? b.startDate >= today : !b.repeatUntil || b.repeatUntil >= today));

  return (
    <div>
      <h2>Breaks</h2>
      <p className="muted">Breaks block a barber's booking times. Existing bookings aren't changed.</p>
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <h3>Add a break</h3>
        {error && <div className="error">{error}</div>}
        {ok && <div className="success">{ok}</div>}
        <form onSubmit={add}>
          <div className="grid-2">
            <div className="field">
              <label>Barber</label>
              <select value={f.barberId} onChange={(e) => setF({ ...f, barberId: e.target.value })}>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Label</label>
              <input type="text" maxLength={40} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Starts</label><input type="time" step={300} required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
            <div className="field"><label>Ends</label><input type="time" step={300} required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
          </div>
          <div className="field">
            <label>Repeat</label>
            <div className="chips">
              {[['none', 'Just once'], ['daily', 'Every day'], ['weekly', 'Certain weekdays']].map(([v, l]) => (
                <button type="button" key={v} className={`chip${f.repeat === v ? ' on' : ''}`} onClick={() => setF({ ...f, repeat: v })}>{l}</button>
              ))}
            </div>
          </div>
          {f.repeat === 'weekly' && (
            <div className="field">
              <label>On these days</label>
              <div className="chips">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button type="button" key={d} className={`chip${f.repeatDays.includes(d) ? ' on' : ''}`} onClick={() => toggleDay(d)}>{DAY_NAMES[d].slice(0, 3)}</button>
                ))}
              </div>
            </div>
          )}
          <div className="grid-2">
            <div className="field">
              <label>{f.repeat === 'none' ? 'Date' : 'Starting from'}</label>
              <input type="date" required min={today} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </div>
            {f.repeat !== 'none' && (
              <div className="field">
                <label>Repeat until (leave empty for no end)</label>
                <input type="date" min={f.startDate} value={f.repeatUntil} onChange={(e) => setF({ ...f, repeatUntil: e.target.value })} />
              </div>
            )}
          </div>
          <button className="btn">Add break</button>
        </form>
      </div>

      <h3>Current breaks</h3>
      {current.length === 0 && <p className="muted">None.</p>}
      <div className="table-wrap">
        <table className="t">
          <tbody>
            {current.map((b) => (
              <tr key={b.id}>
                <td>{data.barbers.find((x) => x.id === b.barberId)?.name}</td>
                <td>{minToLabel(b.startMin)} – {minToLabel(b.endMin)}</td>
                <td>{b.label}</td>
                <td className="muted">{describe(b)}</td>
                <td><button className="btn ghost sm" onClick={() => remove(b.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
