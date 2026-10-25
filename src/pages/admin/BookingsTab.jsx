import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import {
  activeBarbers,
  addDays,
  barberFreeAt,
  breaksFor,
  dowOf,
  getDayHours,
  isBarberUnavailable,
  minToLabel,
  prettyDate,
  qldNow,
} from '../../../supabase/functions/_shared/availability.js';

const weekStart = (d) => addDays(d, -((dowOf(d) + 6) % 7)); // Monday

function BookingForm({ initial, onSave, onClose, title, isEdit }) {
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

function CancelForm({ booking, onClose }) {
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

function BookingCard({ b, onEdit, onCancel, showBarber, nameOf }) {
  return (
    <div className={`bk${b.source === 'admin' ? ' admin' : ''}${b.status === 'cancelled' ? ' cancelled' : ''}`}>
      <div className="time">{minToLabel(b.startMin)} – {minToLabel(b.endMin)}</div>
      <div>{b.customerName}{b.guestName ? ` (for ${b.guestName})` : ''} · {b.serviceName}{showBarber ? ` · ${nameOf(b.barberId)}` : ''}</div>
      <div className="small muted">
        {b.phone && <a href={`tel:${b.phone}`}>{b.phone}</a>} {b.source === 'admin' ? '· added by shop' : '· online'}
        {b.notes ? ` · ${b.notes}` : ''}
        {b.status === 'cancelled' && ` · cancelled by ${b.cancelledBy || 'shop'}${b.cancelReason ? `: ${b.cancelReason}` : ''}`}
      </div>
      {b.status === 'confirmed' && (
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn ghost sm" onClick={() => onEdit(b)}>Edit</button>
          <button className="btn ghost sm" onClick={() => onCancel(b)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default function BookingsTab() {
  const { data } = useShop();
  const [view, setView] = useState('day');
  const [date, setDate] = useState(qldNow().date);
  const [rows, setRows] = useState([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => (view === 'day' ? [date, date] : [weekStart(date), addDays(weekStart(date), 6)]), [view, date]);
  const load = useCallback(async () => {
    setLoading(true);
    setRows(await api.listBookings(range[0], range[1]));
    setLoading(false);
  }, [range]);
  useEffect(() => {
    load();
  }, [load]);

  const nameOf = (id) => data.barbers.find((b) => b.id === id)?.name || '?';
  const visible = rows.filter((b) => showCancelled || b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
  const close = (changed) => {
    setModal(null);
    if (changed) load();
  };
  const cardProps = { onEdit: (b) => setModal({ type: 'edit', booking: b }), onCancel: (b) => setModal({ type: 'cancel', booking: b }), nameOf };

  const hours = getDayHours(data, date);
  const barberCols = activeBarbers(data);

  return (
    <div>
      <h2>Bookings</h2>
      <div className="toolbar">
        <div className="btn-row">
          <button className={`btn sm${view === 'day' ? '' : ' ghost'}`} onClick={() => setView('day')}>Day</button>
          <button className={`btn sm${view === 'week' ? '' : ' ghost'}`} onClick={() => setView('week')}>Week</button>
        </div>
        <div className="btn-row">
          <button className="btn ghost sm" onClick={() => setDate(addDays(date, view === 'day' ? -1 : -7))}>‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 170 }} />
          <button className="btn ghost sm" onClick={() => setDate(addDays(date, view === 'day' ? 1 : 7))}>›</button>
          <button className="btn ghost sm" onClick={() => setDate(qldNow().date)}>Today</button>
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled
        </label>
        <button className="btn sm" onClick={() => setModal({ type: 'new' })}>+ Add booking (phone / walk-in)</button>
      </div>

      {view === 'day' ? (
        <>
          <p className="muted">
            {prettyDate(date)} · {hours.closed ? 'Closed' : `Open ${minToLabel(hours.openMin)} – ${minToLabel(hours.closeMin)}`}
            {hours.special && ' (special hours)'}
            {hours.note ? ` · ${hours.note}` : ''}
          </p>
          <div className="day-cols">
            {barberCols.map((br) => {
              const items = [
                ...visible.filter((b) => b.barberId === br.id).map((b) => ({ kind: 'b', at: b.startMin, b })),
                ...breaksFor(data, br.id, date).map((x) => ({ kind: 'x', at: x.startMin, x })),
              ].sort((a, c) => a.at - c.at);
              return (
                <div key={br.id}>
                  <h3>{br.name}</h3>
                  {isBarberUnavailable(data, br.id, date) && <div className="notice small">Unavailable today</div>}
                  {items.length === 0 && <p className="muted small">No bookings.</p>}
                  {items.map((it) =>
                    it.kind === 'b' ? (
                      <BookingCard key={it.b.id} b={it.b} {...cardProps} />
                    ) : (
                      <div key={it.x.id} className="bk brk">
                        <div className="time">{minToLabel(it.x.startMin)} – {minToLabel(it.x.endMin)}</div>
                        <div>{it.x.label || 'Break'}</div>
                      </div>
                    ),
                  )}
                </div>
              );
            })}
          </div>
          {visible.filter((b) => !barberCols.some((x) => x.id === b.barberId)).map((b) => (
            <BookingCard key={b.id} b={b} showBarber {...cardProps} />
          ))}
        </>
      ) : (
        <div>
          {Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map((d) => {
            const list = visible.filter((b) => b.date === d);
            const h = getDayHours(data, d);
            return (
              <div key={d} style={{ marginBottom: 18 }}>
                <h3 style={{ marginBottom: 6 }}>
                  {prettyDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}{' '}
                  <span className="muted small" style={{ textTransform: 'none' }}>
                    {h.closed ? 'Closed' : `${minToLabel(h.openMin)} – ${minToLabel(h.closeMin)}`} · {list.filter((b) => b.status === 'confirmed').length} bookings
                  </span>
                </h3>
                {list.map((b) => <BookingCard key={b.id} b={b} showBarber {...cardProps} />)}
              </div>
            );
          })}
        </div>
      )}
      {loading && <p className="muted small">Loading…</p>}

      {modal?.type === 'new' && (
        <BookingForm title="Add booking" initial={{ date }} onSave={(b) => api.createAdminBooking(b)} onClose={close} />
      )}
      {modal?.type === 'edit' && (
        <BookingForm
          title="Edit booking"
          isEdit
          initial={modal.booking}
          onSave={(b, notify) =>
            api.updateBooking(
              modal.booking.id,
              { barberId: b.barberId, serviceId: b.serviceId, date: b.date, startMin: b.startMin, customerName: b.customerName, phone: b.phone, email: b.email, notes: b.notes },
              notify,
            )
          }
          onClose={close}
        />
      )}
      {modal?.type === 'cancel' && <CancelForm booking={modal.booking} onClose={close} />}
    </div>
  );
}
