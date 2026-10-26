// Public: a customer views or cancels their booking using the secret link from their email.
import { customerCancelledEmail } from '../_shared/emails.js';
import { cors, json, serviceClient, sendEmail } from '../_shared/server.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { token, action } = await req.json();
    if (!UUID_RE.test(String(token || ''))) return json({ error: 'This link is not valid.' }, 400);

    const db = serviceClient();
    const { data: b, error } = await db.from('bookings').select('*, barbers(name)').eq('cancel_token', token).maybeSingle();
    if (error) throw error;
    if (!b) return json({ error: 'This cancel link is not valid.' }, 404);

    const summary = {
      serviceName: b.service_name,
      barberName: b.barbers?.name,
      date: b.booking_date,
      startMin: b.start_min,
      guestName: b.guest_name,
      status: b.status,
    };

    if (action === 'unsubscribe') {
      if (b.email) await db.from('email_optouts').upsert({ email: b.email.toLowerCase() });
      return json({ ok: true, unsubscribed: true });
    }

    if (action === 'cancel' && b.status === 'confirmed') {
      const { error: upErr } = await db
        .from('bookings')
        .update({ status: 'cancelled', cancelled_by: 'customer', updated_at: new Date().toISOString() })
        .eq('id', b.id);
      if (upErr) throw upErr;
      summary.status = 'cancelled';
      if (b.email) {
        await sendEmail(
          customerCancelledEmail({
            to: b.email,
            name: b.customer_name,
            booking: { serviceName: b.service_name, date: b.booking_date, startMin: b.start_min, guestName: b.guest_name },
            barberName: b.barbers?.name,
          }),
        );
      }
    }
    return json({ ok: true, booking: summary });
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong. Please call us to cancel.' }, 500);
  }
});
