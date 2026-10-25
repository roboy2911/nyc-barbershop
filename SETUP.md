# NYC Barbershop – going live

Until these steps are done the site runs in **demo mode**: bookings are saved only in the visitor's browser, emails are shown in the admin "Email outbox" tab instead of being sent, and the admin password is `demo1234` with any 6-digit code.

All services below have free plans that cover a single shop.

---

## 1. Domain (shop owner does this – needs the shop's ABN)

1. Go to **ventraip.com.au** and search for `nycbarbershop.com.au`.
2. Register it in the business's name using the shop's ABN.

## 2. Supabase (database + admin logins)

1. Sign up at **supabase.com** (use the shop's email) → **New project**. Region: **Sydney**. Save the database password somewhere safe.
2. **SQL Editor → New query** → paste all of `supabase/migrations/001_init.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**:
   - Turn **off** "Allow new users to sign up" (nobody can create their own account).
   - Turn **on** "Secure password change".
4. **Authentication → Multi-Factor** → make sure **TOTP (App Authenticator)** is enabled.
5. **Authentication → URL Configuration**: set **Site URL** to the website address (e.g. `https://nycbarbershop.com.au`) and add `https://nycbarbershop.com.au/admin/reset` to **Redirect URLs**.
6. **Authentication → Users → Add user → Create new user** – once for the owner, once for you. Tick "Auto confirm user".
7. Make both of them admins – **SQL Editor**, run (change the emails):
   ```sql
   insert into public.admins (user_id, label)
   select id, email from auth.users
   where email in ('owner@example.com', 'you@example.com');
   ```
8. **Project Settings → API**: copy the **Project URL** and the **anon public** key – needed in step 4.

The first time each admin signs in at `/admin`, they'll be asked to scan a QR code with Google Authenticator or Microsoft Authenticator. After that they need password + 6-digit code every time.

## 3. Emails (Resend)

1. Sign up at **resend.com** → **Domains → Add domain** → `nycbarbershop.com.au` → add the DNS records it shows in VentraIP's DNS settings → wait for "Verified".
2. **API Keys → Create** → copy the key.
3. Install the Supabase CLI (`npm i -g supabase`), then from this folder:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set RESEND_API_KEY=re_xxx \
     EMAIL_FROM="NYC Barbershop <bookings@nycbarbershop.com.au>" \
     SITE_URL=https://nycbarbershop.com.au \
     ALLOWED_ORIGIN=https://nycbarbershop.com.au
   supabase functions deploy create-booking
   supabase functions deploy cancel-booking
   supabase functions deploy admin-action
   ```

Supabase's built-in emails (password reset) work straight away but are limited to a few per hour. For reliability, in Supabase **Authentication → Emails → SMTP Settings** enter Resend's SMTP details (host `smtp.resend.com`, port 465, user `resend`, password = the API key).

## 4. Website hosting

The site is a static site. Either:

- **GitHub Pages** (current demo): build with the env vars below and push `dist/` to the `gh-pages` branch. For the custom domain: repo **Settings → Pages → Custom domain** → `nycbarbershop.com.au`, and add the DNS records GitHub shows in VentraIP. Then rebuild with `BASE_PATH=/`.
- **Netlify / Vercel / Cloudflare Pages** (recommended once live – handles page links better): import the GitHub repo, build command `npm run build`, output folder `dist`, and add the env vars below. Add a rewrite of `/*` to `/index.html`.

Environment variables (from step 2.8):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
The anon key is safe to be public – the database rules only let it read opening hours, barbers and free times, never customer details.

---

## How the admin page is protected

- Login is handled by Supabase: passwords are stored hashed, never in the website code.
- Every admin needs a 6-digit authenticator code as well as the password (2FA).
- The database itself refuses changes unless the request comes from someone in the `admins` table **who has passed 2FA** – so even someone who finds the admin page, or the site's code, can't change anything.
- Sign-ups are switched off, so nobody can create their own account.
- Supabase limits repeated login attempts.
- Admin sessions end when the browser closes, or after 30 minutes of no activity.
- The admin page isn't linked from the site and is hidden from search engines.
- Customers can only see which times are taken – never names, phones or emails.
- A barber can never be double-booked, even if two people book at the same moment (enforced by the database).

## Editing content

- About text, reviews, social links: `src/content.js`
- Prices, services, hours, barbers, breaks, banner, shop email: the admin page.
- Gallery photos: replace the placeholders in `src/pages/Home.jsx` (put images in `public/gallery/`).
