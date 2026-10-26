// Runs every hour (called by .github/workflows/scheduled.yml):
//  - sends reminder emails about 24 hours before each appointment
//  - tidies up old visitor stats
// Calling it also keeps the free Supabase project from pausing.
import { QLD_OFFSET_HOURS, addDays, qldNow } from '../_shared/availability.js';
import { reminderEmail, reviewRequestEmail } from '../_shared/emails.js';
import { fromDb } from '../_shared/mapping.js';
import { json, serviceClient, sendEmail, SITE_URL } from '../_shared/server.ts';

const HOUR = 3600e3;
const startsAt = (b: { date: string; startMin: number }) =>
  Date.parse(`${b.date}T00:00:00Z`) + b.startMin * 60e3 - QLD_OFFSET_HOURS * HOUR;

// "How was your cut?" email ~a day after the appointment, sent between 9am and 7pm.
// One per customer per 90 days, never after a no-show, and never to people who unsubscribed.
async function sendReviewRequests(db: ReturnType<typeof serviceClient>, now: number) {
  const { data: settings } = await db.from('settings').select('review_requests, google_review_url').eq('id', 1).single();
  if (!settings?.review_requests || !settings.google_review_url) return 'off';
  const hour = new Date(now + QLD_OFFSET_HOURS * HOUR).getUTCHours();
  if (hour < 9 || hour >= 19) return 'waiting for daytime';

  const today = qldNow().date;
  const { data: rows, error } = await db
    .from('bookings')
    .select('*, barbers(name)')
    .eq('status', 'confirmed')
    .eq('no_show', false)
    .is('review_request_sent_at', null)
    .not('email', 'is', null)
    .gte('booking_date', addDays(today, -3))
    .lte('booking_date', today);
  if (error) throw error;

  const { data: optouts } = await db.from('email_optouts').select('email');
  const blocked = new Set((optouts || []).map((o: { email: string }) => o.email.toLowerCase()));
  const since = new Date(now - 90 * 24 * HOUR).toISOString();
  const { data: recent } = await db.from('bookings').select('email').gte('review_request_sent_at', since);
  (recent || []).forEach((r: { email: string }) => r.email && blocked.add(r.email.toLowerCase()));

  let sent = 0;
  for (const r of rows) {
    const b = fromDb.booking(r);
    const email = b.email.toLowerCase();
    const ended = startsAt(b) + (b.endMin - b.startMin) * 60e3;
    const ago = now - ended;
    if (ago < 20 * HOUR || ago > 72 * HOUR) continue;
    const stamp = new Date().toISOString();
    if (blocked.has(email)) {
      // Mark it so it isn't looked at again.
      await db.from('bookings').update({ review_request_sent_at: stamp }).eq('id', b.id);
      continue;
    }
    await sendEmail(
      reviewRequestEmail({
        to: b.email,
        name: b.customerName,
        booking: b,
        barberName: r.barbers?.name,
        reviewUrl: settings.google_review_url,
        unsubscribeUrl: `${SITE_URL}/unsubscribe?token=${b.cancelToken}`,
        bookUrl: `${SITE_URL}/book`,
      }),
    );
    await db.from('bookings').update({ review_request_sent_at: stamp }).eq('id', b.id);
    blocked.add(email);
    sent++;
  }
  return sent;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Not authorised' }, 401);

  const db = serviceClient();
  const result: Record<string, unknown> = {};
  try {
    // Reminders – only once email sending is set up.
    if (!Deno.env.get('RESEND_API_KEY')) {
      result.reminders = 'skipped – email not set up yet';
    } else {
      const now = Date.now();
      const today = qldNow().date;
      const { data: rows, error } = await db
        .from('bookings')
        .select('*, barbers(name)')
        .eq('status', 'confirmed')
        .is('reminder_sent_at', null)
        .not('email', 'is', null)
        .gte('booking_date', today)
        .lte('booking_date', addDays(today, 2));
      if (error) throw error;
      let sent = 0;
      for (const r of rows) {
        const b = fromDb.booking(r);
        const start = startsAt(b);
        const created = Date.parse(r.created_at);
        // Due: starts within the next 24 hours (but not in the next 2), and was
        // booked more than a day ahead (no point reminding someone who just booked).
        if (start - now > 24 * HOUR || start - now < 2 * HOUR || start - created < 24 * HOUR) continue;
        await sendEmail(reminderEmail({ to: b.email, name: b.customerName, booking: b, barberName: r.barbers?.name, siteUrl: SITE_URL }));
        await db.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', b.id);
        sent++;
      }
      result.reminders = sent;
      result.reviewRequests = await sendReviewRequests(db, now);
    }

    // Keep visitor stats to about 13 months.
    await db.from('page_views').delete().lt('day', addDays(qldNow().date, -400));
    result.ok = true;
    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
