import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import {
  activeBarbers,
  addDays,
  breaksFor,
  getDayHours,
  isBarberUnavailable,
  minToLabel,
  prettyDate,
  qldNow,
} from '../../../supabase/functions/_shared/availability.js';

import { BookingCard, BookingForm, CancelForm, confirmAndDelete, weekStart } from './parts.jsx';

export default function BookingsTab() {
  const { data } = useShop();
  const [view, setView] = useState('day');
  const [date, setDate] = useState(qldNow().date);
  const [rows, setRows] = useState([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);

  // Search as you type (short pause so we don't search on every key).
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => api.searchBookings(q).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q]);

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
    if (changed) {
      load();
      if (q.trim().length >= 2) api.searchBookings(q).then(setResults);
    }
  };
  const toggleNoShow = async (b) => {
    await api.setNoShow(b.id, !b.noShow);
    close(true);
  };
  const cardProps = {
    onEdit: (b) => setModal({ type: 'edit', booking: b }),
    onCancel: (b) => setModal({ type: 'cancel', booking: b }),
    onDelete: async (b) => {
      if (await confirmAndDelete(b)) close(true);
    },
    onNoShow: toggleNoShow,
    nameOf,
  };

  const hours = getDayHours(data, date);
  const barberCols = activeBarbers(data);

  return (
    <div>
      <h2>Bookings</h2>
      <div className="search-row no-print">
        <input type="text" placeholder="Search by name, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookings" />
        {q && <button className="btn ghost sm" onClick={() => setQ('')}>Clear</button>}
      </div>
      {results && (
        <div style={{ marginBottom: 24 }}>
          <h3>{results.length} result{results.length === 1 ? '' : 's'} for “{q}”</h3>
          {results.map((b) => <BookingCard key={b.id} b={b} showBarber showDate {...cardProps} />)}
        </div>
      )}
      <div className="print-only"><h2>NYC Barbershop – {view === 'day' ? prettyDate(date) : `Week of ${prettyDate(range[0])}`}</h2></div>
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
        <button className="btn ghost sm" onClick={() => window.print()}>Print</button>
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
