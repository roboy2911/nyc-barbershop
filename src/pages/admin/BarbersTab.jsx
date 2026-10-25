import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import { activeBarbers, minToLabel, prettyDate, qldNow } from '../../../supabase/functions/_shared/availability.js';

function PlanTable({ plan }) {
  if (!plan.length) return <p className="muted">No upcoming bookings are affected.</p>;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>Booking</th><th>What happens</th></tr></thead>
        <tbody>
          {plan.map((p) => (
            <tr key={p.id}>
              <td>
                {prettyDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })} {minToLabel(p.startMin)}<br />
                <span className="small">{p.customerName} · {p.serviceName}</span>
                <div className="small muted">{p.phone} {p.email ? '' : '(no email – call them)'}</div>
              </td>
              <td>{p.action === 'move' ? `Moved to ${p.toBarber}` : 'Cancelled – nobody else free'}{p.email ? ' · customer emailed' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnavailableModal({ barber, onClose }) {
  const today = qldNow().date;
  const [f, setF] = useState({ startDate: today, mode: 'until', endDate: today, reason: '' });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const args = () => ({ barberId: barber.id, startDate: f.startDate, endDate: f.mode === 'until' ? f.endDate : null, reason: f.reason.trim() });

  async function preview(e) {
    e.preventDefault();
    if (f.mode === 'until' && f.endDate < f.startDate) return setError('End date is before start date.');
    setBusy(true);
    setError('');
    try {
      setPlan(await api.setUnavailable({ ...args(), dryRun: true }));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }
  async function confirm() {
    setBusy(true);
    try {
      setResult(await api.setUnavailable({ ...args(), dryRun: false }));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="modal-back">
      <div className="modal">
        <h3>Mark {barber.name} unavailable</h3>
        {error && <div className="error">{error}</div>}
        {result ? (
          <>
            <div className="success">Done. {barber.name} is marked unavailable.</div>
            <PlanTable plan={result} />
            <button className="btn" style={{ marginTop: 14 }} onClick={() => onClose(true)}>Close</button>
          </>
        ) : !plan ? (
          <form onSubmit={preview}>
            <div className="field">
              <label>From</label>
              <input type="date" required min={today} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </div>
            <div className="field">
              <label>Until</label>
              <div className="chips" style={{ marginBottom: 10 }}>
                <button type="button" className={`chip${f.mode === 'until' ? ' on' : ''}`} onClick={() => setF({ ...f, mode: 'until' })}>A set date</button>
                <button type="button" className={`chip${f.mode === 'off' ? ' on' : ''}`} onClick={() => setF({ ...f, mode: 'off' })}>Until I turn them back on</button>
              </div>
              {f.mode === 'until' && <input type="date" required min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />}
            </div>
            <div className="field">
              <label>Reason (sent to customers whose booking has to be cancelled)</label>
              <input type="text" maxLength={200} placeholder="e.g. Tom is on holiday" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            </div>
            <div className="btn-row">
              <button className="btn" disabled={busy}>Next: check bookings</button>
              <button type="button" className="btn ghost" onClick={() => onClose(false)}>Close</button>
            </div>
          </form>
        ) : (
          <>
            <p>Here's what will happen to {barber.name}'s upcoming bookings in that time:</p>
            <PlanTable plan={plan} />
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn" disabled={busy} onClick={confirm}>Confirm</button>
              <button className="btn ghost" onClick={() => setPlan(null)}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RemoveModal({ barber, onClose }) {
  const [stage, setStage] = useState(1);
  const [plan, setPlan] = useState(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function toPreview() {
    setBusy(true);
    try {
      setPlan(await api.removeBarber(barber.id, true));
      setStage(2);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }
  async function remove() {
    if (!window.confirm(`FINAL WARNING: permanently remove ${barber.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      setResult(await api.removeBarber(barber.id, false));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="modal-back">
      <div className="modal danger-zone">
        <h3>Remove {barber.name}</h3>
        {error && <div className="error">{error}</div>}
        {result ? (
          <>
            <div className="success">{barber.name} has been removed.</div>
            <PlanTable plan={result} />
            <button className="btn" style={{ marginTop: 14 }} onClick={() => onClose(true)}>Close</button>
          </>
        ) : stage === 1 ? (
          <>
            <p><strong>Warning 1 of 3.</strong> Removing a barber takes them off the website for good and deletes their breaks. Their upcoming bookings will be moved to another barber where possible, or cancelled (customers are emailed).</p>
            <p className="muted">If they're just on holiday or sick, use <strong>Mark unavailable</strong> instead.</p>
            <div className="btn-row">
              <button className="btn danger" disabled={busy} onClick={toPreview}>I understand – continue</button>
              <button className="btn ghost" onClick={() => onClose(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p><strong>Warning 2 of 3.</strong> This is what will happen to {barber.name}'s upcoming bookings:</p>
            <PlanTable plan={plan} />
            <div className="field" style={{ marginTop: 16 }}>
              <label>Type <strong>{barber.name}</strong> to confirm</label>
              <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>
            <div className="btn-row">
              <button className="btn danger" disabled={busy || typed.trim() !== barber.name} onClick={remove}>Remove {barber.name}</button>
              <button className="btn ghost" onClick={() => onClose(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BarbersTab({ refreshShop }) {
  const { data } = useShop();
  const [name, setName] = useState('');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const barbers = activeBarbers(data);
  const today = qldNow().date;

  const done = async (changed) => {
    setModal(null);
    if (changed) await refreshShop();
  };

  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (barbers.some((b) => b.name.toLowerCase() === n.toLowerCase())) return setError('There is already a barber with that name.');
    try {
      await api.addBarber(n);
      setName('');
      setError('');
      await refreshShop();
    } catch (err) {
      setError(err.message);
    }
  }

  async function rename(b) {
    const n = window.prompt(`New name for ${b.name}:`, b.name);
    if (!n || !n.trim() || n.trim() === b.name) return;
    await api.renameBarber(b.id, n.trim().slice(0, 60));
    await refreshShop();
  }

  async function backOn(u) {
    await api.endUnavailability(u);
    await refreshShop();
  }

  return (
    <div>
      <h2>Barbers</h2>
      {error && <div className="error">{error}</div>}
      <div className="day-cols" style={{ marginBottom: 24 }}>
        {barbers.map((b) => {
          const offs = data.unavailability.filter((u) => u.barberId === b.id && (!u.endDate || u.endDate >= today));
          const offNow = offs.some((u) => u.startDate <= today);
          return (
            <div className="card" key={b.id}>
              <h3 style={{ color: 'var(--text)' }}>{b.name} <span className={`pill ${offNow ? 'closed' : 'open'}`}>{offNow ? 'Unavailable' : 'Available'}</span></h3>
              {offs.map((u) => (
                <div key={u.id} className="notice small">
                  Off from {prettyDate(u.startDate, { day: 'numeric', month: 'short' })}{' '}
                  {u.endDate ? `to ${prettyDate(u.endDate, { day: 'numeric', month: 'short' })}` : 'until turned back on'}
                  {u.reason ? ` – ${u.reason}` : ''}
                  <div style={{ marginTop: 6 }}><button className="btn ghost sm" onClick={() => backOn(u)}>{u.startDate > today ? 'Cancel this time off' : 'Turn back on now'}</button></div>
                </div>
              ))}
              <div className="btn-row">
                <button className="btn sm" onClick={() => setModal({ type: 'off', barber: b })}>Mark unavailable</button>
                <button className="btn ghost sm" onClick={() => rename(b)}>Rename</button>
                <button className="btn ghost sm" disabled={barbers.length <= 1} title={barbers.length <= 1 ? "Can't remove the last barber" : ''} onClick={() => setModal({ type: 'remove', barber: b })}>Remove…</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h3>Add a barber</h3>
        <form onSubmit={add} className="btn-row">
          <input type="text" placeholder="Name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button className="btn">Add</button>
        </form>
        <p className="muted small" style={{ marginTop: 10 }}>New barbers work whenever the shop is open, and appear on the booking page straight away.</p>
      </div>

      {modal?.type === 'off' && <UnavailableModal barber={modal.barber} onClose={done} />}
      {modal?.type === 'remove' && <RemoveModal barber={modal.barber} onClose={done} />}
    </div>
  );
}
