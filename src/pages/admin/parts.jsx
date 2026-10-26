/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import {
  activeBarbers,
  addDays,
  barberFreeAt,
  dowOf,
  getDayHours,
  isBarberUnavailable,
  minToLabel,
  prettyDate,
  qldNow,
} from '../../../supabase/functions/_shared/availability.js';

export const weekStart = (d) => addDays(d, -((dowOf(d) + 6) % 7)); // Monday

export function BookingForm({ initial, onSave, onClose, title, isEdit }) {
  const { data } = useShop();
  const barbers = activeBarbers(data);
  const services = data.services.filter((s) => s.active || s.id === initial?.serviceId);
  const [f, setF] = useState(() => ({
    customerName: '', phone: '', email: '', notes: '',
    serviceId: services[0]?.id, barberId: barbers[0]?.id, date: qldNow().date, startMin: null,
    ...initial,
  }));
  const [dayBookings, setDayBookings] = useState([]);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.listBookings(f.date, f.date).then((rows) => setDayBookings(rows.filter((b) => b.status === 'confirmed' && b.id !== initial?.id)));
  }, [f.date, initial?.id]);

  const svc = data.services.find((s) => s.id === f.serviceId);
  const hours = getDayHours(data, f.date);
  const step = data.settings.slotStep || 15;
  const times = [];
  const from = hours.closed ? 540 : hours.openMin;
  const to = hours.closed ? 1260 : hours.closeMin;
  for (let m = from; m + (svc?.duration || 15) <= to; m += step) times.push(m);
  if (f.startMin != null && !times.includes(Number(f.startMin))) times.unshift(Number(f.startMin));
  const free = (m) => svc && barberFreeAt(data, dayBookings, f.barberId, f.date, m, m + svc.duration);
  const off = isBarberUnavailable(data, f.barberId, f.date);

  async function submit(e) {
    e.preventDefault();
    if (f.startMin == null || f.startMin === '') return setError('Pick a time.');
    const startMin = Number(f.startMin);
    const warnings = [];
    if (hours.closed) warnings.push('the shop is closed that day');
    if (off) warnings.push('that barber is marked unavailable that day');
    if (!free(startMin)) warnings.push('it overlaps a break or another booking');
    if (!hours.closed && startMin + svc.duration > hours.closeMin) warnings.push('it runs past closing time');
    if (warnings.length && !window.confirm(`Heads up: ${warnings.join(', ')}. Save anyway?`)) return;
    setBusy(true);
    setError('');
    try {
      await onSave({ ...f, startMin, endMin: startMin + svc.duration, serviceName: svc.name }, notify);
      onClose(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="modal-back">
      <form className="modal" onSubmit={submit}>
        <h3>{title}</h3>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Customer name *</label>
          <input type="text" required maxLength={100} value={f.customerName} onChange={set('customerName')} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Phone</label>
            <input type="tel" maxLength={30} value={f.phone || ''} onChange={set('phone')} />
          </div>
          <div className="field">
            <label>Email (optional)</label>
            <input type="email" maxLength={200} value={f.email || ''} onChange={set('email')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Service</label>
            <select value={f.serviceId} onChange={set('serviceId')}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
            </select>
          </div>
          <div className="field">
            <label>Barber</label>
            <select value={f.barberId} onChange={set('barberId')}>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Date</label>
            <input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div className="field">
            <label>Time</label>
            <select value={f.startMin ?? ''} onChange={set('startMin')}>
              <option value="">Choose…</option>
              {times.map((m) => (
                <option key={m} value={m}>{minToLabel(m)}{free(m) ? '' : ' (busy)'}</option>
              ))}
            </select>
          </div>
        </div>
        {hours.closed && <div className="notice small">The shop is closed on this day.</div>}
        {off && <div className="notice small">This barber is marked unavailable on this day.</div>}
        <div className="field">
          <label>Notes (only admins see this)</label>
          <input type="text" maxLength={300} value={f.notes || ''} onChange={set('notes')} />
        </div>
        {isEdit && f.email && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the customer if the time, barber or service changes
          </label>
        )}
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn ghost" onClick={() => onClose(false)}>Close</button>
        </div>
      </form>
    </div>
  );
}

export function CancelForm({ booking, onClose }) {
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.cancelBooking(booking.id, reason.trim(), notify && !!booking.email);
      onClose(true);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <div className="modal-back">
      <form className="modal" onSubmit={submit}>
        <h3>Cancel booking</h3>
        <p>{booking.customerName} – {booking.serviceName}, {prettyDate(booking.date)} at {minToLabel(booking.startMin)}</p>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Reason (included in the customer's email)</label>
          <textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Barber is unwell today" />
        </div>
        {booking.email ? (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email {booking.email} to let them know
          </label>
        ) : (
          <p className="muted small">No email on this booking – call {booking.phone || 'the customer'} to let them know.</p>
        )}
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn danger" disabled={busy}>Cancel booking</button>
          <button type="button" className="btn ghost" onClick={() => onClose(false)}>Keep it</button>
        </div>
      </form>
    </div>
  );
}

export function BookingCard({ b, onEdit, onCancel, onNoShow, showBarber, showDate, nameOf }) {
  const past = b.date < qldNow().date || (b.date === qldNow().date && b.startMin <= qldNow().minutes);
  return (
    <div className={`bk${b.source === 'admin' ? ' admin' : ''}${b.status === 'cancelled' ? ' cancelled' : ''}${b.noShow ? ' noshow' : ''}`}>
      <div className="time">
        {showDate && `${prettyDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} · `}
        {minToLabel(b.startMin)} – {minToLabel(b.endMin)}
        {b.noShow && <span className="tag red">No-show</span>}
        {b.source === 'admin' && <span className="tag">Shop</span>}
      </div>
      <div>{b.customerName}{b.guestName ? ` (for ${b.guestName})` : ''} · {b.serviceName}{showBarber ? ` · ${nameOf(b.barberId)}` : ''}</div>
      <div className="small muted">
        {b.phone && <a href={`tel:${b.phone}`}>{b.phone}</a>}
        {b.email && <> · {b.email}</>}
        {b.notes ? ` · ${b.notes}` : ''}
        {b.status === 'cancelled' && ` · cancelled by ${b.cancelledBy || 'shop'}${b.cancelReason ? `: ${b.cancelReason}` : ''}`}
      </div>
      {b.status === 'confirmed' && (onEdit || onNoShow) && (
        <div className="btn-row" style={{ marginTop: 6 }}>
          {onEdit && <button className="btn ghost sm" onClick={() => onEdit(b)}>Edit</button>}
          {onCancel && !past && <button className="btn ghost sm" onClick={() => onCancel(b)}>Cancel</button>}
          {onNoShow && past && (
            <button className="btn ghost sm" onClick={() => onNoShow(b)}>{b.noShow ? 'Undo no-show' : 'Mark no-show'}</button>
          )}
        </div>
      )}
    </div>
  );
}
