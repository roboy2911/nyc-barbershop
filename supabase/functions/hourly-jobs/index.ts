// Runs every hour (called by .github/workflows/scheduled.yml):
//  - sends reminder emails about 24 hours before each appointment
//  - tidies up old visitor stats
// Calling it also keeps the free Supabase project from pausing.
import { QLD_OFFSET_HOURS, addDays, qldNow } from '../_shared/availability.js';
import { reminderEmail } from '../_shared/emails.js';
import { fromDb } from '../_shared/mapping.js';
import { json, serviceClient, sendEmail, SITE_URL } from '../_shared/server.ts';

const HOUR = 3600e3;
const startsAt = (b: { date: string; startMin: number }) =>
  Date.parse(`${b.date}T00:00:00Z`) + b.startMin * 60e3 - QLD_OFFSET_HOURS * HOUR;

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
