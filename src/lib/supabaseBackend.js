// Live mode: talks to Supabase. Used when VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set (see SETUP.md).
//
// Public pages use plain web requests (small and fast). The full Supabase
// library is only downloaded when someone opens the admin page.
import { assembleData, fromDb, toDb } from '../../supabase/functions/_shared/mapping.js';
import { addDays, qldNow } from '../../supabase/functions/_shared/availability.js';
import { resizeImage } from './images.js';

export function makeSupabaseBackend(url, anonKey) {
  const keyHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: { ...keyHeaders, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    if (!res.ok) throw new Error(json?.error || json?.message || 'Something went wrong. Please try again.');
    return json;
  }
  const table = (name, query = 'select=*') => request(`/rest/v1/${name}?${query}`);
  const fn = (name, body) => request(`/functions/v1/${name}`, { method: 'POST', body });

  // Full Supabase client, loaded on demand (admin only).
  let clientPromise;
  const client = () =>
    (clientPromise ||= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: { persistSession: true, storage: window.localStorage }, // stays signed in after closing; Admin signs out after 12h unused
      }),
    ));

  const must = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  async function callFn(name, body) {
    const sb = await client();
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
      const [settings, services, barbers, weeklyHours, specialDays, unavailability, breaks, barberHours, reviews] = await Promise.all([
        table('settings', 'select=*&id=eq.1'),
        table('services'),
        table('barbers'),
        table('weekly_hours'),
        table('special_days'),
        table('barber_unavailability'),
        table('breaks'),
        table('barber_hours').catch(() => []),
        table('reviews', 'select=*&order=sort.asc').catch(() => []),
      ]);
      if (!settings?.[0]) throw new Error('Shop settings are missing – has the database been set up?');
      return assembleData({ settings: settings[0], services, barbers, weeklyHours, specialDays, unavailability, breaks, barberHours, reviews });
    },
    async getBusy(from, to) {
      return (await request('/rest/v1/rpc/get_busy', { method: 'POST', body: { from_date: from, to_date: to } })).map(fromDb.busy);
    },
    async createBooking(payload) {
      return fn('create-booking', payload);
    },
    async cancelLookup(token) {
      return (await fn('cancel-booking', { token, action: 'get' })).booking;
    },
    async cancelByToken(token) {
      return (await fn('cancel-booking', { token, action: 'cancel' })).booking;
    },
    async listGallery() {
      const rows = await table('gallery_photos', 'select=*&order=sort.asc,created_at.desc').catch(() => []);
      const pub = (p) => `${url}/storage/v1/object/public/gallery/${p}`;
      return rows.map((r) => ({ id: r.id, caption: r.caption, sort: r.sort, path: r.path, thumbPath: r.thumb_path, url: pub(r.path), thumbUrl: pub(r.thumb_path) }));
    },
    trackView(view) {
      request('/rest/v1/rpc/track_view', {
        method: 'POST',
        body: { p_path: view.path, p_referrer: view.referrer, p_visitor: view.visitor, p_device: view.device },
      }).catch(() => {});
    },
    async sendContact(msg) {
      await request('/rest/v1/contact_messages', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: { name: msg.name, email: msg.email || null, phone: msg.phone || null, message: msg.message },
      });
    },

    // ---------------- admin login (email + password) ----------------
    auth: {
      async signIn(email, password) {
        const sb = await client();
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          const code = error.code || '';
          if (code === 'email_not_confirmed') throw new Error('This email address hasn\'t been confirmed yet. In Supabase → Authentication → Users, open the user and confirm them.');
          if (code.includes('rate_limit') || error.status === 429) throw new Error('Too many attempts. Please wait a few minutes and try again.');
          if (code === 'invalid_credentials') throw new Error('Wrong email or password. Use “Forgot password” if you\'re not sure.');
          throw new Error(`Couldn't sign in: ${error.message}`);
        }
        const { data: row, error: rowErr } = await sb.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
        if (rowErr || !row) {
          await sb.auth.signOut();
          throw new Error(
            rowErr
              ? `Signed in, but couldn't check admin access: ${rowErr.message}`
              : 'Your password is correct, but this account isn\'t on the admin list yet. Add it with the SQL step in SETUP.md (insert into public.admins …).',
          );
        }
        return { step: 'done' };
      },
      async getAdmin() {
        const { data } = await (await client()).auth.getSession();
        if (!data.session) return null;
        const row = must(await (await client()).from('admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle());
        return row ? { email: data.session.user.email } : null;
      },
      async signOut() {
        await (await client()).auth.signOut();
      },
      async sendReset(email) {
        must(await (await client()).auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}admin/reset` }));
      },
      async updatePassword(newPw) {
        must(await (await client()).auth.updateUser({ password: newPw }));
      },
      async changePassword(current, newPw) {
        const { createClient } = await import('@supabase/supabase-js');
        const { data } = await (await client()).auth.getSession();
        const email = data.session?.user.email;
        // Re-check the current password before allowing a change.
        const check = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error } = await check.auth.signInWithPassword({ email, password: current });
        if (error) throw new Error('Current password is wrong.');
        await check.auth.signOut();
        must(await (await client()).auth.updateUser({ password: newPw }));
      },
      onAuthChange(cb) {
        let unsub = () => {};
        let stopped = false;
        client().then((sb) => {
          if (stopped) return;
          const { data } = sb.auth.onAuthStateChange((event) => cb(event));
          unsub = () => data.subscription.unsubscribe();
        });
        return () => {
          stopped = true;
          unsub();
        };
      },
    },

    async listBookings(from, to) {
      return must(await (await client()).from('bookings').select('*').gte('booking_date', from).lte('booking_date', to)).map(fromDb.booking);
    },
    async searchBookings(q) {
      const term = String(q).replace(/[^\p{L}\p{N} @.+-]/gu, '').trim();
      if (term.length < 2) return [];
      const like = `"*${term}*"`; // PostgREST wildcard, quoted for spaces/dots
      const rows = must(
        await (await client()).from('bookings').select('*')
          .or(`customer_name.ilike.${like},email.ilike.${like},phone.ilike.${like},guest_name.ilike.${like}`)
          .order('booking_date', { ascending: false }).limit(100),
      );
      return rows.map(fromDb.booking);
    },
    async listAllBookings(from) {
      const out = [];
      for (let page = 0; page < 20; page++) {
        const rows = must(await (await client()).from('bookings').select('*').gte('booking_date', from).order('booking_date').range(page * 1000, page * 1000 + 999));
        out.push(...rows.map(fromDb.booking));
        if (rows.length < 1000) break;
      }
      return out;
    },
    async listRecentBookings(limit = 50) {
      const rows = must(await (await client()).from('bookings').select('*').order('created_at', { ascending: false }).limit(limit));
      return rows.map(fromDb.booking);
    },
    async visitStats(days) {
      return must(await (await client()).rpc('visit_stats', { p_days: days }));
    },
    async saveBarberHours(barberId, rows) {
      const sb = await client();
      must(await sb.from('barber_hours').delete().eq('barber_id', barberId));
      const custom = rows.filter((r) => r.off || r.custom).map((r) => toDb.barberHours({ ...r, barberId }));
      if (custom.length) must(await sb.from('barber_hours').insert(custom));
    },
    async exportAll() {
      const sb = await client();
      const tables = ['settings', 'services', 'barbers', 'barber_hours', 'weekly_hours', 'special_days', 'barber_unavailability', 'breaks', 'bookings', 'contact_messages', 'gallery_photos', 'reviews'];
      const out = { exported_at: new Date().toISOString() };
      for (const t of tables) {
        const rows = [];
        for (let page = 0; page < 50; page++) {
          const { data, error } = await sb.from(t).select('*').range(page * 1000, page * 1000 + 999);
          if (error) throw new Error(error.message);
          rows.push(...data);
          if (data.length < 1000) break;
        }
        out[t] = rows;
      }
      return out;
    },
    async uploadPhoto(file, caption, sort) {
      const sb = await client();
      const [full, thumb] = await Promise.all([resizeImage(file, 1600), resizeImage(file, 600, 0.8)]);
      const id = crypto.randomUUID();
      const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
      const up1 = await sb.storage.from('gallery').upload(`${id}.jpg`, full, opts);
      if (up1.error) throw new Error(up1.error.message);
      const up2 = await sb.storage.from('gallery').upload(`${id}-thumb.jpg`, thumb, opts);
      if (up2.error) throw new Error(up2.error.message);
      must(await sb.from('gallery_photos').insert({ path: `${id}.jpg`, thumb_path: `${id}-thumb.jpg`, caption: caption || null, sort }));
    },
    async updatePhoto(id, patch) {
      must(await (await client()).from('gallery_photos').update(patch).eq('id', id));
    },
    async deletePhoto(photo) {
      const sb = await client();
      await sb.storage.from('gallery').remove([photo.path, photo.thumbPath]);
      must(await sb.from('gallery_photos').delete().eq('id', photo.id));
    },
    async listAllReviews() {
      return must(await (await client()).from('reviews').select('*').order('sort')).map(fromDb.review);
    },
    async saveReview(r) {
      const sb = await client();
      const row = { name: r.name, stars: r.stars, text: r.text, visible: r.visible, sort: r.sort ?? 0 };
      if (r.id) must(await sb.from('reviews').update(row).eq('id', r.id));
      else must(await sb.from('reviews').insert(row));
    },
    async deleteReview(id) {
      must(await (await client()).from('reviews').delete().eq('id', id));
    },
    async deleteBooking(id) {
      const { data, error } = await (await client()).from('bookings').delete().eq('id', id).select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error('Not allowed – please sign in again.');
    },
    async setNoShow(id, value) {
      must(await (await client()).from('bookings').update({ no_show: value, updated_at: new Date().toISOString() }).eq('id', id));
    },
    async createAdminBooking(b) {
      const { data, error } = await (await client()).from('bookings').insert({ ...toDb.booking(b), source: 'admin' }).select('*').single();
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
      must(await (await client()).from('weekly_hours').upsert(rows.map(toDb.weeklyHours)));
    },
    async saveSpecialDay(day) {
      must(await (await client()).from('special_days').upsert(toDb.specialDay(day)));
    },
    async deleteSpecialDay(date) {
      must(await (await client()).from('special_days').delete().eq('date', date));
    },

    async addBarber(name) {
      must(await (await client()).from('barbers').insert({ name, sort: 99 }));
    },
    async renameBarber(id, name) {
      must(await (await client()).from('barbers').update({ name }).eq('id', id));
    },
    async setUnavailable(args) {
      return (await callFn('admin-action', { action: 'set_unavailable', ...args })).plan;
    },
    async endUnavailability(u) {
      const today = qldNow().date;
      if (u.startDate >= today) must(await (await client()).from('barber_unavailability').delete().eq('id', u.id));
      else must(await (await client()).from('barber_unavailability').update({ end_date: addDays(today, -1) }).eq('id', u.id));
    },
    async removeBarber(barberId, dryRun) {
      return (await callFn('admin-action', { action: 'remove_barber', barberId, dryRun })).plan;
    },

    async addBreak(br) {
      must(await (await client()).from('breaks').insert(toDb.break(br)));
    },
    async deleteBreak(id) {
      must(await (await client()).from('breaks').delete().eq('id', id));
    },

    async saveService(svc) {
      if (svc.id) must(await (await client()).from('services').update(toDb.service(svc)).eq('id', svc.id));
      else must(await (await client()).from('services').insert(toDb.service({ ...svc, sort: 99 })));
    },
    async saveSettings(settings) {
      must(await (await client()).from('settings').update(toDb.settings(settings)).eq('id', 1));
    },

    async listMessages() {
      return must(await (await client()).from('contact_messages').select('*').order('created_at', { ascending: false })).map((m) => ({
        ...m,
        createdAt: m.created_at,
      }));
    },
    async setMessageHandled(id, handled) {
      must(await (await client()).from('contact_messages').update({ handled }).eq('id', id));
    },
    async deleteMessage(id) {
      must(await (await client()).from('contact_messages').delete().eq('id', id));
    },
  };
}
