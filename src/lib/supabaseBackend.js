// Live mode: talks to Supabase. Used when VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set (see SETUP.md).
import { createClient } from '@supabase/supabase-js';
import { assembleData, fromDb, toDb } from '../../supabase/functions/_shared/mapping.js';
import { addDays, qldNow } from '../../supabase/functions/_shared/availability.js';

export function makeSupabaseBackend(url, anonKey) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, storage: window.sessionStorage }, // admin login ends when the browser closes
  });

  const must = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  async function callFn(name, body) {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) {
      let msg = 'Something went wrong. Please try again.';
      try {
        const j = await error.context.json();
        if (j?.error) msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return data;
  }

  return {
    mode: 'live',

    async loadData() {
      const q = (t) => sb.from(t).select('*');
      const [settings, services, barbers, weeklyHours, specialDays, unavailability, breaks] = await Promise.all([
        sb.from('settings').select('*').eq('id', 1).single(),
        q('services'),
        q('barbers'),
        q('weekly_hours'),
        q('special_days'),
        q('barber_unavailability'),
        q('breaks'),
      ]);
      return assembleData({
        settings: must(settings),
        services: must(services),
        barbers: must(barbers),
        weeklyHours: must(weeklyHours),
        specialDays: must(specialDays),
        unavailability: must(unavailability),
        breaks: must(breaks),
      });
    },
    async getBusy(from, to) {
      return must(await sb.rpc('get_busy', { from_date: from, to_date: to })).map(fromDb.busy);
    },
    async createBooking(payload) {
      return callFn('create-booking', payload);
    },
    async cancelLookup(token) {
      return (await callFn('cancel-booking', { token, action: 'get' })).booking;
    },
    async cancelByToken(token) {
      return (await callFn('cancel-booking', { token, action: 'cancel' })).booking;
    },
    async sendContact(msg) {
      must(await sb.from('contact_messages').insert({ name: msg.name, email: msg.email || null, phone: msg.phone || null, message: msg.message }));
    },

    // ---------------- admin login (password + 2FA) ----------------
    auth: {
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Wrong email or password.');
        const factors = must(await sb.auth.mfa.listFactors());
        const totp = factors.totp.find((f) => f.status === 'verified');
        if (totp) return { step: 'challenge', factorId: totp.id };
        return { step: 'enroll' };
      },
      async enrollMfa() {
        // Remove any half-finished setup first.
        const factors = must(await sb.auth.mfa.listFactors());
        for (const f of factors.all.filter((x) => x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id });
        const d = must(await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'NYC Barbershop admin' }));
        return { factorId: d.id, qr: d.totp.qr_code, secret: d.totp.secret };
      },
      async verifyMfa(factorId, code) {
        const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
        if (error) throw new Error('That code is wrong or expired. Try the newest code.');
        return true;
      },
      async getAdmin() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        const aal = must(await sb.auth.mfa.getAuthenticatorAssuranceLevel());
        if (aal.currentLevel !== 'aal2') return null;
        const row = must(await sb.from('admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle());
        return row ? { email: data.session.user.email } : null;
      },
      async signOut() {
        await sb.auth.signOut();
      },
      async sendReset(email) {
        must(await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}admin/reset` }));
      },
      async updatePassword(newPw) {
        must(await sb.auth.updateUser({ password: newPw }));
      },
      async changePassword(current, newPw) {
        const { data } = await sb.auth.getSession();
        const email = data.session?.user.email;
        // Re-check the current password before allowing a change.
        const check = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error } = await check.auth.signInWithPassword({ email, password: current });
        if (error) throw new Error('Current password is wrong.');
        await check.auth.signOut();
        must(await sb.auth.updateUser({ password: newPw }));
      },
      onAuthChange(cb) {
        const { data } = sb.auth.onAuthStateChange((event) => cb(event));
        return () => data.subscription.unsubscribe();
      },
    },

    async listBookings(from, to) {
      return must(await sb.from('bookings').select('*').gte('booking_date', from).lte('booking_date', to)).map(fromDb.booking);
    },
    async createAdminBooking(b) {
      const { data, error } = await sb.from('bookings').insert({ ...toDb.booking(b), source: 'admin' }).select('*').single();
      if (error) {
        if (error.code === '23P01') throw new Error('That barber already has a booking at that time.');
        throw new Error(error.message);
      }
      return fromDb.booking(data);
    },
    async updateBooking(id, changes, notify = true) {
      return callFn('admin-action', { action: 'update_booking', id, changes, notify });
    },
    async cancelBooking(id, reason, notify = true) {
      return callFn('admin-action', { action: 'cancel_booking', id, reason, notify });
    },

    async saveWeeklyHours(rows) {
      must(await sb.from('weekly_hours').upsert(rows.map(toDb.weeklyHours)));
    },
    async saveSpecialDay(day) {
      must(await sb.from('special_days').upsert(toDb.specialDay(day)));
    },
    async deleteSpecialDay(date) {
      must(await sb.from('special_days').delete().eq('date', date));
    },

    async addBarber(name) {
      must(await sb.from('barbers').insert({ name, sort: 99 }));
    },
    async renameBarber(id, name) {
      must(await sb.from('barbers').update({ name }).eq('id', id));
    },
    async setUnavailable(args) {
      return (await callFn('admin-action', { action: 'set_unavailable', ...args })).plan;
    },
    async endUnavailability(u) {
      const today = qldNow().date;
      if (u.startDate >= today) must(await sb.from('barber_unavailability').delete().eq('id', u.id));
      else must(await sb.from('barber_unavailability').update({ end_date: addDays(today, -1) }).eq('id', u.id));
    },
    async removeBarber(barberId, dryRun) {
      return (await callFn('admin-action', { action: 'remove_barber', barberId, dryRun })).plan;
    },

    async addBreak(br) {
      must(await sb.from('breaks').insert(toDb.break(br)));
    },
    async deleteBreak(id) {
      must(await sb.from('breaks').delete().eq('id', id));
    },

    async saveService(svc) {
      if (svc.id) must(await sb.from('services').update(toDb.service(svc)).eq('id', svc.id));
      else must(await sb.from('services').insert(toDb.service({ ...svc, sort: 99 })));
    },
    async saveSettings(settings) {
      must(await sb.from('settings').update(toDb.settings(settings)).eq('id', 1));
    },

    async listMessages() {
      return must(await sb.from('contact_messages').select('*').order('created_at', { ascending: false })).map((m) => ({
        ...m,
        createdAt: m.created_at,
      }));
    },
    async setMessageHandled(id, handled) {
      must(await sb.from('contact_messages').update({ handled }).eq('id', id));
    },
    async deleteMessage(id) {
      must(await sb.from('contact_messages').delete().eq('id', id));
    },
  };
}
