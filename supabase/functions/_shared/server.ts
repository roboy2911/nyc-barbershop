// Helpers used by the server functions.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { assembleData, fromDb } from './mapping.js';

export const SITE_URL = (Deno.env.get('SITE_URL') || 'http://localhost:5173').replace(/\/$/, '');
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || SITE_URL;

export const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export async function loadData(db: SupabaseClient) {
  const q = (t: string) => db.from(t).select('*');
  const [settings, services, barbers, weeklyHours, specialDays, unavailability, breaks, barberHours] = await Promise.all([
    db.from('settings').select('*').eq('id', 1).single(),
    q('services'),
    q('barbers'),
    q('weekly_hours'),
    q('special_days'),
    q('barber_unavailability'),
    q('breaks'),
    q('barber_hours'),
  ]);
  for (const r of [settings, services, barbers, weeklyHours, specialDays, unavailability, breaks]) {
    if (r.error) throw r.error;
  }
  return assembleData({
    settings: settings.data,
    services: services.data!,
    barbers: barbers.data!,
    weeklyHours: weeklyHours.data!,
    specialDays: specialDays.data!,
    unavailability: unavailability.data!,
    breaks: breaks.data!,
    barberHours: barberHours.error ? [] : barberHours.data!,
  });
}

/** Confirmed bookings (full rows) between two dates. */
export async function loadBookings(db: SupabaseClient, from: string, to: string) {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .gte('booking_date', from)
    .lte('booking_date', to);
  if (error) throw error;
  return data.map(fromDb.booking);
}

type Email = { to: string; subject: string; html: string; text: string };

/** Sends an email through Resend. If no key is set yet, it just logs it. */
export async function sendEmail(email: Email) {
  if (!email.to) return;
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') || 'NYC Barbershop <bookings@nycbarbershop.com.au>';
  if (!key) {
    console.log('[email not sent – RESEND_API_KEY missing]', email.to, email.subject);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
  });
  if (!res.ok) console.error('Email failed', res.status, await res.text());
}

/** Checks the caller is a signed-in admin who has passed 2FA. */
export async function requireAdmin(req: Request, db: SupabaseClient) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  // The token was verified by getUser above; read its 2FA level.
  let aal = '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    aal = payload.aal;
  } catch {
    return null;
  }
  if (aal !== 'aal2') return null;
  const { data: row } = await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return row ? data.user : null;
}
