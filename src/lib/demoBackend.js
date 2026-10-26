// Demo mode: everything is stored in this browser only, and emails are shown in
// an "Email outbox" tab instead of being sent. Used until Supabase is connected.
import {
  addDays,
  qldNow,
  checkBookingItems,
  planBarberChanges,
} from '../../supabase/functions/_shared/availability.js';
import {
  confirmationEmail,
  customerCancelledEmail,
  shopCancelledEmail,
  barberChangedEmail,
  bookingChangedEmail,
} from '../../supabase/functions/_shared/emails.js';
import { blobToDataUrl, resizeImage } from './images.js';

const GALLERY_KEY = 'nyc-demo-gallery';
const readGallery = () => {
  try {
    return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeGallery = (list) => {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(list));
  } catch {
    throw new Error('Demo storage is full – remove a photo first.');
  }
};

const KEY = 'nyc-barbershop-demo-v1';
const DEMO_PASSWORD_KEY = 'nyc-barbershop-demo-pw';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
const siteUrl = () => window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');

function seed() {
  const tom = uid();
  const john = uid();
  const services = [
    { id: uid(), name: 'Haircut', duration: 35, priceCents: 3500, popular: true, description: 'Placeholder description – classic cut, fade or scissor work, finished and styled.', sort: 1, active: true },
    { id: uid(), name: 'Beard', duration: 25, priceCents: 2500, description: 'Placeholder description – beard shape, line and trim.', sort: 2, active: true },
    { id: uid(), name: 'Haircut & Beard', duration: 45, priceCents: 5500, description: 'Placeholder description – the full works.', sort: 3, active: true },
    { id: uid(), name: 'Line Up', duration: 15, priceCents: 1500, description: 'Placeholder description – sharp edges between cuts.', sort: 4, active: true },
  ];
  const data = {
    settings: { maxConcurrent: null, bookingWindowDays: 30, cutoffMinutes: 30, slotStep: 15, publicEmail: 'placeholder@nycbarbershop.com.au', phone: '0410 823 773', banner: '' },
    services,
    barbers: [
      { id: tom, name: 'Tom', removed: false, sort: 1 },
      { id: john, name: 'John', removed: false, sort: 2 },
    ],
    weeklyHours: [
      { dow: 0, closed: false, openMin: 600, closeMin: 960 },
      { dow: 1, closed: false, openMin: 540, closeMin: 1050 },
      { dow: 2, closed: false, openMin: 540, closeMin: 1050 },
      { dow: 3, closed: false, openMin: 540, closeMin: 1050 },
      { dow: 4, closed: false, openMin: 540, closeMin: 1260 },
      { dow: 5, closed: false, openMin: 540, closeMin: 1050 },
      { dow: 6, closed: false, openMin: 540, closeMin: 960 },
    ],
    specialDays: [],
    unavailability: [],
    barberHours: [],
    breaks: [
      { id: uid(), barberId: tom, startDate: qldNow().date, startMin: 720, endMin: 750, repeat: 'daily', repeatDays: [], repeatUntil: null, label: 'Lunch' },
    ],
  };
  // A few sample bookings so the calendar shows greyed-out times.
  const today = qldNow().date;
  const mk = (d, barberId, svc, startMin, name, source = 'online') => ({
    id: uid(), groupId: uid(), barberId, serviceId: svc.id, serviceName: svc.name, date: addDays(today, d),
    startMin, endMin: startMin + svc.duration, customerName: name, phone: '0400 000 000',
    email: source === 'online' ? `${name.split(' ')[0].toLowerCase()}@example.com` : null, guestName: null,
    source, status: 'confirmed', cancelToken: uid(), createdAt: new Date().toISOString(),
  });
  const bookings = [
    mk(1, tom, services[0], 600, 'Sample Customer A'),
    mk(1, john, services[2], 600, 'Sample Customer B'),
    mk(1, tom, services[1], 840, 'Sample Customer C', 'admin'),
    mk(2, john, services[0], 555, 'Sample Customer D'),
    mk(3, tom, services[3], 660, 'Sample Customer E'),
  ];
  return { data, bookings, messages: [], outbox: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const s = seed();
  save(s);
  return s;
}
function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
function mutate(fn) {
  const s = load();
  const out = fn(s);
  save(s);
  return out;
}
const toBusy = (b) => ({ id: b.id, barberId: b.barberId, date: b.date, startMin: b.startMin, endMin: b.endMin });
const names = (s) => Object.fromEntries(s.data.barbers.map((b) => [b.id, b.name]));
const send = (s, email) => {
  if (email.to) s.outbox.unshift({ ...email, sentAt: new Date().toISOString() });
};
const confirmed = (s) => s.bookings.filter((b) => b.status === 'confirmed');
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 150));

function overlapsAny(s, b, ignoreId) {
  return confirmed(s).some(
    (x) => x.id !== ignoreId && x.barberId === b.barberId && x.date === b.date && x.startMin < b.endMin && b.startMin < x.endMin,
  );
}

function applyPlan(s, plan, reason) {
  const n = names(s);
  for (const p of plan) {
    const b = s.bookings.find((x) => x.id === p.booking.id);
    if (p.action === 'move') {
      const oldName = n[b.barberId];
      b.barberId = p.toBarberId;
      send(s, barberChangedEmail({ to: b.email, name: b.customerName, booking: b, oldBarberName: oldName, newBarberName: p.toBarberName, siteUrl: siteUrl() }));
    } else {
      b.status = 'cancelled';
      b.cancelledBy = 'shop';
      b.cancelReason = reason;
      send(s, shopCancelledEmail({ to: b.email, name: b.customerName, booking: b, barberName: n[b.barberId], reason, siteUrl: siteUrl() }));
    }
  }
}
function describePlan(s, plan) {
  const n = names(s);
  return plan.map((p) => ({
    id: p.booking.id, customerName: p.booking.customerName, phone: p.booking.phone, email: p.booking.email,
    serviceName: p.booking.serviceName, date: p.booking.date, startMin: p.booking.startMin,
    fromBarber: n[p.booking.barberId], action: p.action, toBarber: p.toBarberName || null,
  }));
}

let session = null;

export const demoBackend = {
  mode: 'demo',

  async loadData() {
    return delay(load().data);
  },
  async getBusy(from, to) {
    return delay(confirmed(load()).filter((b) => b.date >= from && b.date <= to).map(toBusy));
  },
  async createBooking({ items, customer }) {
    await delay();
    return mutate((s) => {
      const now = qldNow();
      const check = checkBookingItems(s.data, confirmed(s).map(toBusy), items, now);
      if (!check.ok) throw new Error(check.error);
      const groupId = uid();
      const created = check.rows.map((r) => ({
        ...r, id: uid(), groupId, customerName: customer.name.trim(), phone: customer.phone.trim(),
        email: customer.email.trim().toLowerCase(), source: 'online', status: 'confirmed', cancelToken: uid(),
        createdAt: new Date().toISOString(),
      }));
      s.bookings.push(...created);
      send(s, confirmationEmail({ to: customer.email, name: customer.name, bookings: created, barberNames: names(s), siteUrl: siteUrl() }));
      return { ok: true, bookings: created };
    });
  },
  async cancelLookup(token) {
    await delay();
    const s = load();
    const b = s.bookings.find((x) => x.cancelToken === token);
    if (!b) throw new Error('This cancel link is not valid.');
    return { ...b, barberName: names(s)[b.barberId] };
  },
  async cancelByToken(token) {
    await delay();
    return mutate((s) => {
      const b = s.bookings.find((x) => x.cancelToken === token);
      if (!b) throw new Error('This cancel link is not valid.');
      if (b.status === 'confirmed') {
        b.status = 'cancelled';
        b.cancelledBy = 'customer';
        send(s, customerCancelledEmail({ to: b.email, name: b.customerName, booking: b, barberName: names(s)[b.barberId] }));
      }
      return { ...b, barberName: names(s)[b.barberId] };
    });
  },
  async listGallery() {
    return readGallery().sort((a, b) => a.sort - b.sort);
  },
  async uploadPhoto(file, caption, sort) {
    // Demo keeps small copies only, in this browser.
    const url = await blobToDataUrl(await resizeImage(file, 900, 0.75));
    writeGallery([...readGallery(), { id: uid(), caption, sort, url, thumbUrl: url }]);
  },
  async updatePhoto(id, patch) {
    writeGallery(readGallery().map((p) => (p.id === id ? { ...p, ...patch } : p)));
  },
  async deletePhoto(photo) {
    writeGallery(readGallery().filter((p) => p.id !== photo.id));
  },
  trackView(view) {
    try {
      const k = 'nyc-demo-views';
      const list = JSON.parse(localStorage.getItem(k) || '[]');
      list.push({ ...view, day: qldNow().date });
      localStorage.setItem(k, JSON.stringify(list.slice(-5000)));
    } catch {
      /* ignore */
    }
  },
  async visitStats(days) {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem('nyc-demo-views') || '[]');
    } catch {
      /* ignore */
    }
    const since = addDays(qldNow().date, -days + 1);
    list = list.filter((v) => v.day >= since);
    const group = (key, val) => {
      const m = new Map();
      list.forEach((v) => {
        const k = key(v);
        if (k == null) return;
        const e = m.get(k) || { set: new Set(), n: 0 };
        e.n++;
        e.set.add(v.visitor);
        m.set(k, e);
      });
      return [...m.entries()].map(([k, e]) => val(k, e));
    };
    return {
      daily: group((v) => v.day, (day, e) => ({ day, views: e.n, visitors: e.set.size })).sort((a, b) => a.day.localeCompare(b.day)),
      pages: group((v) => v.path, (path, e) => ({ path, views: e.n })).sort((a, b) => b.views - a.views).slice(0, 10),
      referrers: group((v) => v.referrer || null, (referrer, e) => ({ referrer, views: e.n })).sort((a, b) => b.views - a.views).slice(0, 10),
      devices: group((v) => v.device || 'unknown', (device, e) => ({ device, visitors: e.set.size })),
      visitors: new Set(list.map((v) => v.visitor)).size,
      views: list.length,
      bookings: load().bookings.filter((b) => b.source === 'online' && (b.createdAt || '').slice(0, 10) >= since).length,
    };
  },
  async sendContact(msg) {
    await delay();
    mutate((s) => s.messages.unshift({ ...msg, id: uid(), handled: false, createdAt: new Date().toISOString() }));
  },

  // ---------------- admin ----------------
  auth: {
    async signIn(email, password) {
      await delay();
      const pw = localStorage.getItem(DEMO_PASSWORD_KEY) || 'demo1234';
      if (password !== pw) throw new Error('Wrong email or password.');
      session = { email, aal: 'aal1' };
      return { step: 'challenge', factorId: 'demo' };
    },
    async enrollMfa() {
      return { factorId: 'demo', qr: null, secret: 'DEMO-MODE' };
    },
    async verifyMfa(_factorId, code) {
      await delay();
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code.');
      session = { ...session, aal: 'aal2' };
      return true;
    },
    async getAdmin() {
      return session?.aal === 'aal2' ? { email: session.email } : null;
    },
    async signOut() {
      session = null;
    },
    async sendReset() {
      await delay();
    },
    async updatePassword(newPw) {
      localStorage.setItem(DEMO_PASSWORD_KEY, newPw);
    },
    async changePassword(current, newPw) {
      const pw = localStorage.getItem(DEMO_PASSWORD_KEY) || 'demo1234';
      if (current !== pw) throw new Error('Current password is wrong.');
      localStorage.setItem(DEMO_PASSWORD_KEY, newPw);
    },
    onAuthChange() {
      return () => {};
    },
  },

  async listBookings(from, to) {
    return delay(load().bookings.filter((b) => b.date >= from && b.date <= to));
  },
  async searchBookings(q) {
    const t = String(q).toLowerCase().trim();
    if (t.length < 2) return [];
    return delay(
      load().bookings
        .filter((b) => [b.customerName, b.email, b.phone, b.guestName].some((v) => v && v.toLowerCase().includes(t)))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 100),
    );
  },
  async listAllBookings(from) {
    return delay(load().bookings.filter((b) => b.date >= from));
  },
  async listRecentBookings(limit = 50) {
    return delay([...load().bookings].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, limit));
  },
  async saveBarberHours(barberId, rows) {
    mutate((s) => {
      s.data.barberHours = (s.data.barberHours || []).filter((h) => h.barberId !== barberId)
        .concat(rows.filter((r) => r.off || r.custom).map((r) => ({ barberId, dow: r.dow, off: !!r.off, startMin: r.off ? null : r.startMin, endMin: r.off ? null : r.endMin })));
    });
  },
  async exportAll() {
    const s = load();
    return { exported_at: new Date().toISOString(), ...s.data, bookings: s.bookings, contact_messages: s.messages };
  },
  async deleteBooking(id) {
    mutate((s) => (s.bookings = s.bookings.filter((b) => b.id !== id)));
  },
  async setNoShow(id, value) {
    mutate((s) => (s.bookings.find((b) => b.id === id).noShow = value));
  },
  async createAdminBooking(b) {
    await delay();
    return mutate((s) => {
      const row = { ...b, id: uid(), groupId: uid(), source: 'admin', status: 'confirmed', cancelToken: uid(), createdAt: new Date().toISOString() };
      if (overlapsAny(s, row)) throw new Error('That barber already has a booking at that time.');
      s.bookings.push(row);
      return row;
    });
  },
  async updateBooking(id, changes, notify = true) {
    await delay();
    return mutate((s) => {
      const b = s.bookings.find((x) => x.id === id);
      const before = { ...b };
      const svc = s.data.services.find((x) => x.id === (changes.serviceId ?? b.serviceId));
      const next = { ...b, ...changes };
      if (svc) {
        next.serviceName = svc.name;
        next.endMin = next.startMin + svc.duration;
      }
      if (overlapsAny(s, next, id)) throw new Error('That barber already has a booking at that time.');
      Object.assign(b, next);
      const changed = b.date !== before.date || b.startMin !== before.startMin || b.barberId !== before.barberId || b.serviceName !== before.serviceName;
      if (notify && changed) {
        const n = names(s);
        send(s, bookingChangedEmail({ to: b.email, name: b.customerName, before, after: b, oldBarberName: n[before.barberId], newBarberName: n[b.barberId], siteUrl: siteUrl() }));
      }
    });
  },
  async cancelBooking(id, reason, notify = true) {
    await delay();
    mutate((s) => {
      const b = s.bookings.find((x) => x.id === id);
      b.status = 'cancelled';
      b.cancelledBy = 'shop';
      b.cancelReason = reason;
      if (notify) send(s, shopCancelledEmail({ to: b.email, name: b.customerName, booking: b, barberName: names(s)[b.barberId], reason, siteUrl: siteUrl() }));
    });
  },

  async saveWeeklyHours(rows) {
    mutate((s) => (s.data.weeklyHours = rows));
  },
  async saveSpecialDay(day) {
    mutate((s) => {
      s.data.specialDays = s.data.specialDays.filter((d) => d.date !== day.date).concat(day);
    });
  },
  async deleteSpecialDay(date) {
    mutate((s) => (s.data.specialDays = s.data.specialDays.filter((d) => d.date !== date)));
  },

  async addBarber(name) {
    mutate((s) => s.data.barbers.push({ id: uid(), name, removed: false, sort: s.data.barbers.length + 1 }));
  },
  async renameBarber(id, name) {
    mutate((s) => (s.data.barbers.find((b) => b.id === id).name = name));
  },
  async setUnavailable({ barberId, startDate, endDate, reason, dryRun }) {
    await delay();
    return mutate((s) => {
      const today = qldNow().date;
      const from = startDate > today ? startDate : today;
      const inRange = (b) => b.date >= from && (!endDate || b.date <= endDate);
      const affected = confirmed(s).filter((b) => b.barberId === barberId && inRange(b));
      const after = { ...s.data, unavailability: [...s.data.unavailability, { barberId, startDate, endDate: endDate || null }] };
      const plan = planBarberChanges(after, confirmed(s).filter(inRange), affected);
      if (dryRun) return describePlan(s, plan);
      s.data.unavailability.push({ id: uid(), barberId, startDate, endDate: endDate || null, reason });
      applyPlan(s, plan, reason || `${names(s)[barberId]} is unavailable`);
      return describePlan(s, plan);
    });
  },
  async endUnavailability(u) {
    mutate((s) => {
      const today = qldNow().date;
      const row = s.data.unavailability.find((x) => x.id === u.id);
      if (row.startDate >= today) s.data.unavailability = s.data.unavailability.filter((x) => x.id !== u.id);
      else row.endDate = addDays(today, -1);
    });
  },
  async removeBarber(barberId, dryRun) {
    await delay();
    return mutate((s) => {
      const today = qldNow().date;
      const affected = confirmed(s).filter((b) => b.barberId === barberId && b.date >= today);
      const after = { ...s.data, barbers: s.data.barbers.map((b) => (b.id === barberId ? { ...b, removed: true } : b)) };
      const plan = planBarberChanges(after, confirmed(s).filter((b) => b.date >= today), affected);
      if (dryRun) return describePlan(s, plan);
      const n = names(s);
      applyPlan(s, plan, `${n[barberId]} is no longer with the shop`);
      s.data.barbers.find((b) => b.id === barberId).removed = true;
      s.data.breaks = s.data.breaks.filter((b) => b.barberId !== barberId);
      return describePlan(s, plan);
    });
  },

  async addBreak(br) {
    mutate((s) => s.data.breaks.push({ ...br, id: uid() }));
  },
  async deleteBreak(id) {
    mutate((s) => (s.data.breaks = s.data.breaks.filter((b) => b.id !== id)));
  },

  async saveService(svc) {
    mutate((s) => {
      if (svc.id) Object.assign(s.data.services.find((x) => x.id === svc.id), svc);
      else s.data.services.push({ ...svc, id: uid(), sort: s.data.services.length + 1 });
    });
  },
  async saveSettings(settings) {
    mutate((s) => (s.data.settings = { ...s.data.settings, ...settings }));
  },

  async listMessages() {
    return delay(load().messages);
  },
  async setMessageHandled(id, handled) {
    mutate((s) => (s.messages.find((m) => m.id === id).handled = handled));
  },
  async deleteMessage(id) {
    mutate((s) => (s.messages = s.messages.filter((m) => m.id !== id)));
  },

  async outbox() {
    return load().outbox;
  },
  resetDemo() {
    localStorage.removeItem(KEY);
  },
};
