import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import { money } from '../Services.jsx';
import { BookingCard, BookingForm, CancelForm, confirmAndDelete, weekStart } from './parts.jsx';
import {
  addDays,
  barberFreeAt,
  getDayHours,
  minToLabel,
  prettyDate,
  qldNow,
  workingBarbers,
} from '../../../supabase/functions/_shared/availability.js';

export default function TodayTab() {
  const { data } = useShop();
  const now = qldNow();
  const [today, setToday] = useState([]);
  const [week, setWeek] = useState([]);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    const ws = weekStart(now.date);
    const rows = await api.listBookings(ws, addDays(ws, 6));
    setWeek(rows.filter((b) => b.status === 'confirmed'));
    setToday(rows.filter((b) => b.date === now.date && b.status === 'confirmed').sort((a, b) => a.startMin - b.startMin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // keep it fresh if left open on the counter
    return () => clearInterval(t);
  }, [load]);

  const nameOf = (id) => data.barbers.find((b) => b.id === id)?.name || '?';
  const priceOf = (b) => data.services.find((s) => s.id === b.serviceId)?.priceCents || 0;
  const hours = getDayHours(data, now.date);
  const upcoming = today.filter((b) => b.endMin > now.minutes);
  const takings = today.filter((b) => !b.noShow).reduce((t, b) => t + priceOf(b), 0);
  const step = data.settings.slotStep || 15;
  const roundedNow = Math.ceil(now.minutes / step) * step;
  const working = workingBarbers(data, now.date);

  const barberStatus = (br) => {
    if (hours.closed) return 'Shop closed';
    if (barberFreeAt(data, today, br.id, now.date, now.minutes, now.minutes + 15)) {
      const next = today.find((b) => b.barberId === br.id && b.startMin >= now.minutes);
      return next ? `Free now · next at ${minToLabel(next.startMin)}` : 'Free now';
    }
    const cur = today.find((b) => b.barberId === br.id && b.startMin <= now.minutes && b.endMin > now.minutes);
    return cur ? `With ${cur.customerName} until ${minToLabel(cur.endMin)}` : 'On a break';
  };

  function walkIn() {
    const free = working.find((br) => barberFreeAt(data, today, br.id, now.date, roundedNow, roundedNow + 15));
    setModal({ type: 'new', initial: { date: now.date, startMin: roundedNow, barberId: (free || working[0])?.id } });
  }

  const close = (changed) => {
    setModal(null);
    if (changed) load();
  };
  const cardProps = {
    onEdit: (b) => setModal({ type: 'edit', booking: b }),
    onCancel: (b) => setModal({ type: 'cancel', booking: b }),
    onDelete: async (b) => {
      if (await confirmAndDelete(b)) close(true);
    },
    onNoShow: async (b) => {
      await api.setNoShow(b.id, !b.noShow);
      load();
    },
    nameOf,
    showBarber: true,
  };

  return (
    <div>
      <h2>Today</h2>
      <p className="muted">
        {prettyDate(now.date)} · {hours.closed ? 'Closed today' : `Open ${minToLabel(hours.openMin)} – ${minToLabel(hours.closeMin)}`}
        {hours.note ? ` · ${hours.note}` : ''}
      </p>

      <div className="stats">
        <div className="stat"><div className="v">{today.length}</div><div className="l">Bookings today</div></div>
        <div className="stat"><div className="v">{upcoming.length}</div><div className="l">Still to come</div></div>
        <div className="stat"><div className="v">{money(takings) || '$0'}</div><div className="l">Booked value today</div></div>
        <div className="stat"><div className="v">{week.length}</div><div className="l">Bookings this week</div></div>
      </div>

      <div className="btn-row" style={{ marginBottom: 24 }}>
        <button className="btn" onClick={walkIn} disabled={hours.closed || !working.length}>+ Walk-in now</button>
        <button className="btn ghost" onClick={() => setModal({ type: 'new', initial: { date: now.date } })}>+ Phone booking</button>
      </div>

      <div className="about" style={{ gap: 24 }}>
        <div>
          <h3>Up next</h3>
          {upcoming.length === 0 && <p className="muted">Nothing else booked today.</p>}
          {upcoming.map((b) => <BookingCard key={b.id} b={b} {...cardProps} />)}
          {today.length > upcoming.length && (
            <>
              <h3 style={{ marginTop: 20 }}>Earlier today</h3>
              {today.filter((b) => b.endMin <= now.minutes).map((b) => <BookingCard key={b.id} b={b} {...cardProps} />)}
            </>
          )}
        </div>
        <div>
          <h3>Barbers right now</h3>
          {data.barbers.filter((b) => !b.removed).map((br) => {
            const on = working.some((w) => w.id === br.id);
            return (
              <div className="card" key={br.id} style={{ marginBottom: 10, padding: 14 }}>
                <strong>{br.name}</strong>{' '}
                <span className={`pill ${on ? 'open' : 'closed'}`}>{on ? 'Working' : 'Off today'}</span>
                {on && <div className="small muted" style={{ marginTop: 4 }}>{barberStatus(br)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {modal?.type === 'new' && (
        <BookingForm title="Add booking" initial={modal.initial} onSave={(b) => api.createAdminBooking(b)} onClose={close} />
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
