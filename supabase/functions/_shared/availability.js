// Booking rules shared by the website and the server, so both always agree
// on which times are free. All times are Queensland time (UTC+10, no daylight
// saving). Times of day are stored as "minutes since midnight" (e.g. 9:30 am = 570).

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const QLD_OFFSET_HOURS = 10;

// ---------- date helpers (dates are 'YYYY-MM-DD' strings) ----------
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmtDate(dt) {
  return dt.toISOString().slice(0, 10);
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDate(d);
}
export function dowOf(s) {
  return parseDate(s).getUTCDay();
}
export function qldNow(nowMs = Date.now()) {
  const d = new Date(nowMs + QLD_OFFSET_HOURS * 3600e3);
  return { date: fmtDate(d), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export function minToLabel(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}
export function minToHM(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function hmToMin(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}
export function prettyDate(s, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return parseDate(s).toLocaleDateString('en-AU', { ...opts, timeZone: 'UTC' });
}

const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

// ---------- opening hours ----------
export function getDayHours(data, date) {
  const sp = data.specialDays.find((s) => s.date === date);
  if (sp) {
    return sp.closed
      ? { closed: true, special: true, note: sp.note }
      : { closed: false, special: true, note: sp.note, openMin: sp.openMin, closeMin: sp.closeMin };
  }
  const w = data.weeklyHours.find((x) => x.dow === dowOf(date));
  if (!w || w.closed) return { closed: true };
  return { closed: false, openMin: w.openMin, closeMin: w.closeMin };
}

// ---------- barbers ----------
export function isBarberUnavailable(data, barberId, date) {
  return data.unavailability.some(
    (u) => u.barberId === barberId && u.startDate <= date && (!u.endDate || date <= u.endDate),
  );
}
export function activeBarbers(data) {
  return data.barbers.filter((b) => !b.removed);
}
export function workingBarbers(data, date) {
  return activeBarbers(data).filter((b) => !isBarberUnavailable(data, b.id, date));
}

// ---------- breaks ----------
export function breakApplies(br, date) {
  if (date < br.startDate) return false;
  if (br.repeat === 'none') return date === br.startDate;
  if (br.repeatUntil && date > br.repeatUntil) return false;
  if (br.repeat === 'daily') return true;
  if (br.repeat === 'weekly') return (br.repeatDays || []).includes(dowOf(date));
  return false;
}
export function breaksFor(data, barberId, date) {
  return data.breaks.filter((b) => b.barberId === barberId && breakApplies(b, date));
}

// How many appointments can run at the same time: one per working barber,
// optionally capped lower by the admin setting.
export function capacityFor(data, date) {
  const n = workingBarbers(data, date).length;
  const cap = data.settings.maxConcurrent;
  return cap ? Math.min(n, cap) : n;
}

function maxOverlap(intervals, s, e) {
  const rel = intervals.filter((i) => overlaps(i.startMin, i.endMin, s, e));
  let max = 0;
  const points = [s, ...rel.map((i) => i.startMin).filter((p) => p > s && p < e)];
  for (const p of points) {
    const c = rel.filter((i) => i.startMin <= p && p < i.endMin).length;
    if (c > max) max = c;
  }
  return max;
}

export function barberFreeAt(data, busy, barberId, date, s, e) {
  return (
    !busy.some((x) => x.date === date && x.barberId === barberId && overlaps(x.startMin, x.endMin, s, e)) &&
    !breaksFor(data, barberId, date).some((br) => overlaps(br.startMin, br.endMin, s, e))
  );
}

/**
 * All start times for one day.
 * busy: [{ barberId, date, startMin, endMin }] – existing confirmed bookings.
 * barberId: a barber id, or 'all'.
 * Returns { closed, note, slots: [{ startMin, endMin, available, freeBarbers }] }.
 * Times that are past (or inside the cut-off) are left out; booked times are
 * returned with available=false so they can be shown greyed out.
 */
export function getSlots(data, busy, { date, duration, barberId, now = qldNow() }) {
  const hours = getDayHours(data, date);
  if (hours.closed) return { closed: true, note: hours.note, slots: [] };
  const lastDay = addDays(now.date, data.settings.bookingWindowDays);
  if (date < now.date || date > lastDay) return { closed: false, outOfRange: true, slots: [] };

  const step = data.settings.slotStep || 15;
  const cutoff = data.settings.cutoffMinutes ?? 30;
  const working = workingBarbers(data, date);
  const candidates = barberId === 'all' ? working : working.filter((b) => b.id === barberId);
  const dayBusy = busy.filter((b) => b.date === date);
  const cap = capacityFor(data, date);

  const slots = [];
  for (let s = hours.openMin; s + duration <= hours.closeMin; s += step) {
    const e = s + duration;
    if (date === now.date && s < now.minutes + cutoff) continue;
    const shopFull = maxOverlap(dayBusy, s, e) >= cap;
    const free = shopFull ? [] : candidates.filter((b) => barberFreeAt(data, dayBusy, b.id, date, s, e));
    slots.push({ startMin: s, endMin: e, available: free.length > 0, freeBarbers: free.map((b) => b.id) });
  }
  return {
    closed: false,
    note: hours.note,
    special: hours.special,
    barberOff: barberId !== 'all' && candidates.length === 0,
    slots,
  };
}

/** Days (from today) a customer can choose in the calendar. */
export function bookableDates(data, now = qldNow()) {
  const out = [];
  for (let i = 0; i <= data.settings.bookingWindowDays; i++) out.push(addDays(now.date, i));
  return out;
}

/**
 * Server-side check for a new online booking (one or more appointments).
 * Returns { ok: true, rows } or { ok: false, error }.
 */
export function checkBookingItems(data, busy, items, now = qldNow()) {
  const working = [...busy];
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const svc = data.services.find((s) => s.id === it.serviceId && s.active);
    if (!svc) return { ok: false, error: `Appointment ${i + 1}: that service isn't available.` };
    const barber = activeBarbers(data).find((b) => b.id === it.barberId);
    if (!barber) return { ok: false, error: `Appointment ${i + 1}: that barber isn't available.` };
    const res = getSlots(data, working, { date: it.date, duration: svc.duration, barberId: it.barberId, now });
    const slot = res.slots.find((s) => s.startMin === it.startMin);
    if (!slot || !slot.available) {
      return { ok: false, error: `Sorry, ${barber.name} at ${minToLabel(it.startMin)} on ${prettyDate(it.date)} has just been taken. Please pick another time.` };
    }
    const row = {
      barberId: barber.id,
      serviceId: svc.id,
      serviceName: svc.name,
      date: it.date,
      startMin: it.startMin,
      endMin: it.startMin + svc.duration,
      guestName: (it.guestName || '').trim().slice(0, 80) || null,
    };
    rows.push(row);
    working.push(row);
  }
  return { ok: true, rows };
}

/**
 * When a barber stops working (time off or removed), work out what happens to
 * their bookings: move each to another free barber, or cancel if nobody is free.
 * `data` must already reflect the change (barber marked unavailable/removed).
 * busy: all confirmed bookings (with ids) on the affected dates.
 */
export function planBarberChanges(data, busy, affected) {
  let working = busy.filter((b) => !affected.some((a) => a.id === b.id));
  const plan = [];
  const sorted = [...affected].sort((a, b) => (a.date + a.startMin).localeCompare(b.date + b.startMin) || a.startMin - b.startMin);
  for (const bk of sorted) {
    const others = workingBarbers(data, bk.date).filter((b) => b.id !== bk.barberId);
    const hours = getDayHours(data, bk.date);
    const target = others.find((b) => barberFreeAt(data, working, b.id, bk.date, bk.startMin, bk.endMin));
    if (target && !hours.closed) {
      plan.push({ booking: bk, action: 'move', toBarberId: target.id, toBarberName: target.name });
      working = [...working, { ...bk, barberId: target.id }];
    } else {
      plan.push({ booking: bk, action: 'cancel' });
    }
  }
  return plan;
}
