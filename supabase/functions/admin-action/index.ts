// Admin-only actions that also email customers.
import { planBarberChanges, qldNow } from '../_shared/availability.js';
import { shopCancelledEmail, barberChangedEmail, bookingChangedEmail } from '../_shared/emails.js';
import { fromDb } from '../_shared/mapping.js';
import { cors, json, serviceClient, loadData, sendEmail, requireAdmin, SITE_URL } from '../_shared/server.ts';

type Db = ReturnType<typeof serviceClient>;

async function futureBookings(db: Db, from: string, barberId?: string, to?: string | null) {
  let q = db.from('bookings').select('*').eq('status', 'confirmed').gte('booking_date', from);
  if (barberId) q = q.eq('barber_id', barberId);
  if (to) q = q.lte('booking_date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data.map(fromDb.booking);
}

function describePlan(plan: any[], names: Record<string, string>) {
  return plan.map((p) => ({
    id: p.booking.id,
    customerName: p.booking.customerName,
    phone: p.booking.phone,
    email: p.booking.email,
    serviceName: p.booking.serviceName,
    date: p.booking.date,
    startMin: p.booking.startMin,
    fromBarber: names[p.booking.barberId],
    action: p.action,
    toBarber: p.toBarberName || null,
  }));
}

async function applyPlan(db: Db, plan: any[], names: Record<string, string>, reason: string) {
  const now = new Date().toISOString();
  for (const p of plan) {
    const b = p.booking;
    let action = p.action;
    if (action === 'move') {
      const { error } = await db.from('bookings').update({ barber_id: p.toBarberId, updated_at: now }).eq('id', b.id);
      if (error) action = 'cancel'; // someone grabbed that time in the meantime
      else if (b.email) {
        await sendEmail(
          barberChangedEmail({
            to: b.email,
            name: b.customerName,
            booking: { ...b, barberId: p.toBarberId },
            oldBarberName: names[b.barberId],
            newBarberName: p.toBarberName,
            siteUrl: SITE_URL,
          }),
        );
      }
    }
    if (action === 'cancel') {
      await db
        .from('bookings')
        .update({ status: 'cancelled', cancelled_by: 'shop', cancel_reason: reason, updated_at: now })
        .eq('id', b.id);
      if (b.email) {
        await sendEmail(
          shopCancelledEmail({ to: b.email, name: b.customerName, booking: b, barberName: names[b.barberId], reason, siteUrl: SITE_URL }),
        );
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = serviceClient();
  const admin = await requireAdmin(req, db);
  if (!admin) return json({ error: 'Not authorised. Please sign in again.' }, 401);

  try {
    const body = await req.json();
    const today = qldNow().date;
    const data = await loadData(db);
    const names: Record<string, string> = Object.fromEntries(data.barbers.map((b: any) => [b.id, b.name]));

    switch (body.action) {
      case 'cancel_booking': {
        const { data: row, error } = await db.from('bookings').select('*').eq('id', body.id).single();
        if (error) throw error;
        const b = fromDb.booking(row);
        const reason = String(body.reason || '').slice(0, 500);
        await db
          .from('bookings')
          .update({ status: 'cancelled', cancelled_by: 'shop', cancel_reason: reason, updated_at: new Date().toISOString() })
          .eq('id', b.id);
        if (body.notify !== false && b.email) {
          await sendEmail(shopCancelledEmail({ to: b.email, name: b.customerName, booking: b, barberName: names[b.barberId], reason, siteUrl: SITE_URL }));
        }
        return json({ ok: true });
      }

      case 'update_booking': {
        const { data: row, error } = await db.from('bookings').select('*').eq('id', body.id).single();
        if (error) throw error;
        const before = fromDb.booking(row);
        const c = body.changes || {};
        const svc = data.services.find((s: any) => s.id === (c.serviceId ?? before.serviceId));
        const startMin = c.startMin ?? before.startMin;
        const update = {
          barber_id: c.barberId ?? before.barberId,
          service_id: svc?.id ?? before.serviceId,
          service_name: svc?.name ?? before.serviceName,
          booking_date: c.date ?? before.date,
          start_min: startMin,
          end_min: startMin + (svc?.duration ?? before.endMin - before.startMin),
          customer_name: c.customerName ?? before.customerName,
          phone: c.phone ?? before.phone,
          email: c.email ?? before.email,
          notes: c.notes ?? before.notes,
          updated_at: new Date().toISOString(),
        };
        const { data: upd, error: upErr } = await db.from('bookings').update(update).eq('id', body.id).select('*').single();
        if (upErr) {
          if (upErr.code === '23P01') return json({ error: 'That barber already has a booking at that time.' }, 409);
          throw upErr;
        }
        const after = fromDb.booking(upd);
        const timeChanged =
          after.date !== before.date || after.startMin !== before.startMin || after.barberId !== before.barberId || after.serviceName !== before.serviceName;
        if (body.notify !== false && timeChanged && after.email) {
          await sendEmail(
            bookingChangedEmail({
              to: after.email,
              name: after.customerName,
              before,
              after,
              oldBarberName: names[before.barberId],
              newBarberName: names[after.barberId],
              siteUrl: SITE_URL,
            }),
          );
        }
        return json({ ok: true });
      }

      case 'set_unavailable': {
        const { barberId, startDate, endDate, reason, dryRun } = body;
        if (!names[barberId] || !startDate) return json({ error: 'Missing barber or start date.' }, 400);
        if (endDate && endDate < startDate) return json({ error: 'End date is before start date.' }, 400);
        const from = startDate > today ? startDate : today;
        const affected = await futureBookings(db, from, barberId, endDate);
        const after = { ...data, unavailability: [...data.unavailability, { barberId, startDate, endDate: endDate || null }] };
        const allBusy = await futureBookings(db, from, undefined, endDate);
        const plan = planBarberChanges(after, allBusy, affected);
        if (dryRun) return json({ ok: true, plan: describePlan(plan, names) });

        const { error } = await db
          .from('barber_unavailability')
          .insert({ barber_id: barberId, start_date: startDate, end_date: endDate || null, reason: reason || null });
        if (error) throw error;
        await applyPlan(db, plan, names, reason || `${names[barberId]} is unavailable`);
        return json({ ok: true, plan: describePlan(plan, names) });
      }

      case 'remove_barber': {
        const { barberId, dryRun } = body;
        if (!names[barberId]) return json({ error: 'Barber not found.' }, 404);
        const affected = await futureBookings(db, today, barberId);
        const after = { ...data, barbers: data.barbers.map((b: any) => (b.id === barberId ? { ...b, removed: true } : b)) };
        const allBusy = await futureBookings(db, today);
        const plan = planBarberChanges(after, allBusy, affected);
        if (dryRun) return json({ ok: true, plan: describePlan(plan, names) });

        await applyPlan(db, plan, names, `${names[barberId]} is no longer with the shop`);
        const { error } = await db.from('barbers').update({ removed: true }).eq('id', barberId);
        if (error) throw error;
        await db.from('breaks').delete().eq('barber_id', barberId);
        return json({ ok: true, plan: describePlan(plan, names) });
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong on the server.' }, 500);
  }
});
