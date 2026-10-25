import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useShop } from '../App.jsx';
import { api } from '../lib/api.js';
import { money } from './Services.jsx';
import {
  activeBarbers,
  addDays,
  getSlots,
  minToLabel,
  parseDate,
  prettyDate,
  qldNow,
} from '../../supabase/functions/_shared/availability.js';

const STEPS = ['Barber', 'Service', 'Date & time', 'Your details'];

function Calendar({ from, to, value, onPick, dayInfo }) {
  const [month, setMonth] = useState(from.slice(0, 7));
  const first = parseDate(`${month}-01`);
  const lead = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const nextMonth = addDays(`${month}-01`, 32).slice(0, 7);
  return (
    <div className="cal">
      <div className="cal-head">
        <button className="btn ghost sm" disabled={prevMonth < from.slice(0, 7)} onClick={() => setMonth(prevMonth)} aria-label="Previous month">‹</button>
        <strong>{first.toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
        <button className="btn ghost sm" disabled={nextMonth > to.slice(0, 7)} onClick={() => setMonth(nextMonth)} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="cal-dow">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cal-day blank" />;
          const inRange = d >= from && d <= to;
          const info = inRange ? dayInfo(d) : { ok: false, label: '' };
          return (
            <button key={d} className={`cal-day${value === d ? ' sel' : ''}`} disabled={!info.ok} onClick={() => onPick(d)}>
              {Number(d.slice(8))}
              {inRange && !info.ok && <small>{info.label}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Book() {
  const { data } = useShop();
  const [params] = useSearchParams();
  const barbers = activeBarbers(data);
  const services = data.services.filter((s) => s.active);
  const now = qldNow();
  const lastDay = addDays(now.date, data.settings.bookingWindowDays);

  const [step, setStep] = useState(0);
  const [barberId, setBarberId] = useState(null);
  const [serviceId, setServiceId] = useState(params.get('service') || null);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [pickedBarber, setPickedBarber] = useState(null);
  const [cart, setCart] = useState([]);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', website: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const loadBusy = () => api.getBusy(now.date, addDays(lastDay, 1)).then(setBusy).catch(() => setBusy([]));
  useEffect(() => {
    loadBusy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const service = services.find((s) => s.id === serviceId);
  const allBusy = useMemo(() => [...(busy || []), ...cart], [busy, cart]);
  const nameOf = (id) => data.barbers.find((b) => b.id === id)?.name;

  const daySlots = (d) => getSlots(data, allBusy, { date: d, duration: service.duration, barberId, now });
  const dayInfo = (d) => {
    const r = daySlots(d);
    if (r.closed) return { ok: false, label: 'Closed' };
    if (r.barberOff) return { ok: false, label: 'Off' };
    if (r.slots.some((s) => s.available)) return { ok: true };
    return { ok: false, label: r.slots.length ? 'Full' : 'Closed' };
  };
  const today = date && service && busy ? daySlots(date) : null;

  function chooseSlot(s) {
    setSlot(s);
    setPickedBarber(s.freeBarbers.length === 1 ? s.freeBarbers[0] : barberId !== 'all' ? barberId : null);
  }

  function addToCart() {
    const item = { serviceId, serviceName: service.name, duration: service.duration, priceCents: service.priceCents, barberId: pickedBarber, date, startMin: slot.startMin, endMin: slot.endMin, guestName: '' };
    setCart([...cart, item]);
    setSlot(null);
    setPickedBarber(null);
  }

  function another() {
    setStep(0);
    setBarberId(null);
    setServiceId(null);
    setDate(null);
    setSlot(null);
  }

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await api.createBooking({
        items: cart.map((c) => ({ barberId: c.barberId, serviceId: c.serviceId, date: c.date, startMin: c.startMin, guestName: c.guestName })),
        customer: { name: form.name, phone: form.phone, email: form.email },
        website: form.website,
      });
      setDone({ ...res, email: form.email });
    } catch (err) {
      setError(err.message);
      loadBusy();
    }
    setSending(false);
  }

  if (done) {
    return (
      <>
        <div className="page-head"><div className="container"><h1>You're booked in</h1></div></div>
        <div className="container page" style={{ maxWidth: 640 }}>
          <div className="success">Booking confirmed! A confirmation has been sent to {done.email}, with a link to cancel if your plans change.</div>
          <div className="card">
            {cart.map((c, i) => (
              <div key={i} className="cart-item">
                <div>
                  <strong>{c.serviceName}</strong>{c.guestName ? ` for ${c.guestName}` : ''} with {nameOf(c.barberId)}
                  <div className="muted small">{prettyDate(c.date)} at {minToLabel(c.startMin)}</div>
                </div>
              </div>
            ))}
            <p className="muted small" style={{ marginTop: 14 }}>NYC Barbershop · Shop 9, 328 Foxwell Road, Coomera East Shopping Centre</p>
          </div>
          <div style={{ marginTop: 20 }}><Link className="btn ghost" to="/">Back to home</Link></div>
        </div>
      </>
    );
  }

  const total = cart.reduce((t, c) => t + (c.priceCents || 0), 0);

  return (
    <>
      <div className="page-head">
        <div className="container">
          <h1>Book an appointment</h1>
          <p>Pick your barber, service and time · Walk-ins also welcome</p>
        </div>
      </div>
      <div className="container page">
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`s${i === step ? ' on' : i < step ? ' done' : ''}`}>{i + 1}. {s}</div>
          ))}
        </div>

        <div className="book-layout">
          <div>
            {step === 0 && (
              <>
                <h3>Choose your barber</h3>
                <div className="choice-grid">
                  <button className={`choice${barberId === 'all' ? ' sel' : ''}`} onClick={() => { setBarberId('all'); setStep(1); }}>
                    <span className="t">All barbers</span>
                    <span className="d">See every free time</span>
                  </button>
                  {barbers.map((b) => (
                    <button key={b.id} className={`choice${barberId === b.id ? ' sel' : ''}`} onClick={() => { setBarberId(b.id); setStep(1); }}>
                      <span className="t">{b.name}</span>
                      <span className="d">See {b.name}'s times</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h3>Choose a service</h3>
                <div className="choice-grid">
                  {services.map((s) => (
                    <button key={s.id} className={`choice${serviceId === s.id ? ' sel' : ''}`} onClick={() => { setServiceId(s.id); setSlot(null); setStep(2); }}>
                      <span className="t">{s.name}</span>
                      <span className="d">{s.duration} mins · {money(s.priceCents)}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 18 }}><button className="btn ghost sm" onClick={() => setStep(0)}>← Back</button></div>
              </>
            )}

            {step === 2 && service && (
              <>
                <h3>Choose a date</h3>
                {!busy ? (
                  <p className="muted">Loading available times…</p>
                ) : (
                  <Calendar from={now.date} to={lastDay} value={date} onPick={(d) => { setDate(d); setSlot(null); }} dayInfo={dayInfo} />
                )}
                {today && (
                  <div style={{ marginTop: 24 }}>
                    <h3>Times on {prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                    {today.note && <div className="notice">{today.note}</div>}
                    <div className="legend"><span><i />Available</span><span><i className="x" />Booked</span></div>
                    <div className="slots">
                      {today.slots.map((s) => (
                        <button key={s.startMin} className={`slot${slot?.startMin === s.startMin ? ' sel' : ''}`} disabled={!s.available} onClick={() => chooseSlot(s)}>
                          {minToLabel(s.startMin)}
                          {!s.available && <span className="b">Booked</span>}
                        </button>
                      ))}
                    </div>
                    {today.slots.length === 0 && <p className="muted">No times left on this day.</p>}
                  </div>
                )}
                {slot && slot.freeBarbers.length > 1 && barberId === 'all' && (
                  <div style={{ marginTop: 20 }}>
                    <h3>Who would you like?</h3>
                    <div className="chips">
                      {slot.freeBarbers.map((id) => (
                        <button key={id} className={`chip${pickedBarber === id ? ' on' : ''}`} onClick={() => setPickedBarber(id)}>{nameOf(id)}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="btn-row" style={{ marginTop: 22 }}>
                  <button className="btn ghost" onClick={() => setStep(1)}>← Back</button>
                  <button className="btn" disabled={!slot || !pickedBarber} onClick={() => { addToCart(); setStep(3); }}>Continue</button>
                </div>
              </>
            )}

            {step === 3 && (
              <form onSubmit={submit}>
                <h3>Your appointments</h3>
                <div className="card" style={{ marginBottom: 20 }}>
                  {cart.map((c, i) => (
                    <div key={i} className="cart-item" style={{ flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <strong>{c.serviceName}</strong> with {nameOf(c.barberId)}
                        <div className="muted small">{prettyDate(c.date)} at {minToLabel(c.startMin)} · {c.duration} mins</div>
                        {cart.length > 1 && (
                          <input type="text" placeholder="Who is this for? (optional)" maxLength={80} value={c.guestName} style={{ marginTop: 8 }}
                            onChange={(e) => setCart(cart.map((x, j) => (j === i ? { ...x, guestName: e.target.value } : x)))} />
                        )}
                      </div>
                      <button type="button" className="btn ghost sm" onClick={() => { const n = cart.filter((_, j) => j !== i); setCart(n); if (!n.length) another(); }}>Remove</button>
                    </div>
                  ))}
                  {cart.length < 4 && (
                    <button type="button" className="btn ghost sm" style={{ marginTop: 14 }} onClick={another}>+ Add another person / appointment</button>
                  )}
                </div>

                <h3>Your details</h3>
                {error && <div className="error">{error}</div>}
                <div className="field">
                  <label htmlFor="b-name">Name *</label>
                  <input id="b-name" type="text" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="b-phone">Phone *</label>
                    <input id="b-phone" type="tel" required minLength={8} maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="b-email">Email *</label>
                    <input id="b-email" type="email" required maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="hp" aria-hidden="true">
                  <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
                </div>
                <p className="muted small">We'll email your confirmation with a link to cancel any time.</p>
                <button className="btn" disabled={sending || !cart.length}>{sending ? 'Booking…' : `Confirm booking${cart.length > 1 ? 's' : ''}`}</button>
              </form>
            )}
          </div>

          <aside className="card summary">
            <h3>Summary</h3>
            {cart.map((c, i) => (
              <div key={i} className="small" style={{ marginBottom: 10 }}>
                <strong>{c.serviceName}</strong> · {nameOf(c.barberId)}<br />
                <span className="muted">{prettyDate(c.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {minToLabel(c.startMin)}</span>
              </div>
            ))}
            {step < 3 && (
              <div className="small muted">
                <div>Barber: {barberId ? (barberId === 'all' ? 'All barbers' : nameOf(barberId)) : '—'}</div>
                <div>Service: {service ? `${service.name} (${service.duration} mins)` : '—'}</div>
                <div>Date: {date ? prettyDate(date, { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</div>
                <div>Time: {slot ? minToLabel(slot.startMin) : '—'}{pickedBarber && slot ? ` with ${nameOf(pickedBarber)}` : ''}</div>
              </div>
            )}
            {total > 0 && step === 3 && <div style={{ marginTop: 10 }}>Total: <strong>{money(total)}</strong> <span className="muted small">(pay in store)</span></div>}
          </aside>
        </div>
      </div>
    </>
  );
}

