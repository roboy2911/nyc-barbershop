// Public: a customer makes a booking (one or more appointments).
import { checkBookingItems, qldNow, addDays } from '../_shared/availability.js';
import { confirmationEmail } from '../_shared/emails.js';
import { cors, json, serviceClient, loadData, loadBookings, sendEmail, SITE_URL } from '../_shared/server.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    if (body.website) return json({ ok: true, bookings: [] }); // spam-bot trap field

    const name = String(body.customer?.name || '').trim();
    const phone = String(body.customer?.phone || '').trim();
    const email = String(body.customer?.email || '').trim().toLowerCase();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!name || name.length > 100) return json({ error: 'Please enter your name.' }, 400);
    if (!/^[0-9 +()-]{8,20}$/.test(phone)) return json({ error: 'Please enter a valid phone number.' }, 400);
    if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: 'Please enter a valid email address.' }, 400);
    if (items.length < 1 || items.length > 4) return json({ error: 'You can book between 1 and 4 appointments at once.' }, 400);

    const db = serviceClient();
    const now = qldNow();

    // Simple abuse limit: no more than 6 upcoming bookings per email address.
    const { count } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('status', 'confirmed')
      .gte('booking_date', now.date);
    if ((count || 0) + items.length > 6) {
      return json({ error: 'You already have several upcoming bookings. Please call us to book more.' }, 429);
    }

    const data = await loadData(db);
    const busy = await loadBookings(db, now.date, addDays(now.date, data.settings.bookingWindowDays + 1));
    const check = checkBookingItems(data, busy, items, now);
    if (!check.ok) return json({ error: check.error }, 409);

    const groupId = crypto.randomUUID();
    const rows = check.rows.map((r: any) => ({
      group_id: groupId,
      barber_id: r.barberId,
      service_id: r.serviceId,
      service_name: r.serviceName,
      booking_date: r.date,
      start_min: r.startMin,
      end_min: r.endMin,
      guest_name: r.guestName,
      customer_name: name,
      phone,
      email,
      source: 'online',
    }));
    const { data: inserted, error } = await db.from('bookings').insert(rows).select('*');
    if (error) {
      if (error.code === '23P01') return json({ error: 'Sorry, one of those times was just taken. Please pick another time.' }, 409);
      throw error;
    }

    const barberNames = Object.fromEntries(data.barbers.map((b: any) => [b.id, b.name]));
    const bookings = inserted.map((r: any) => ({
      id: r.id,
      barberId: r.barber_id,
      serviceName: r.service_name,
      date: r.booking_date,
      startMin: r.start_min,
      guestName: r.guest_name,
      cancelToken: r.cancel_token,
    }));
    await sendEmail(confirmationEmail({ to: email, name, bookings, barberNames, siteUrl: SITE_URL }));

    return json({ ok: true, bookings: bookings.map(({ cancelToken: _t, ...b }: any) => b) });
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong. Please try again or call us.' }, 500);
  }
});
