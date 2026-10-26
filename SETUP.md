# NYC Barbershop – going live

Until these steps are done the site runs in **demo mode**: bookings are saved only in the visitor's browser, emails are shown in the admin "Email outbox" tab instead of being sent, and the admin password is `demo1234` with any 6-digit code.

All services below have free plans that cover a single shop.

---

## 1. Domain (shop owner does this – needs the shop's ABN)

1. Go to **ventraip.com.au** and search for `nycbarbershop.com.au`.
2. Register it in the business's name using the shop's ABN.

## 2. Supabase (database + admin logins)

1. Sign up at **supabase.com** → **New project**. Region: **Sydney**. Save the database password somewhere safe.
2. **SQL Editor → New query** → paste all of `supabase/migrations/001_init.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up", turn **on** "Secure password change".
4. **Authentication → URL Configuration**: **Site URL** = the website address (e.g. `https://roboy2911.github.io/nyc-barbershop`), and add `<that address>/admin/reset` to **Redirect URLs**.
5. **Authentication → Users → Add user → Create new user** for each admin (tick "Auto confirm user").
6. Make them admins – **SQL Editor**, run (change the emails):
   ```sql
   insert into public.admins (user_id, label)
   select id, email from auth.users
   where email in ('owner@example.com', 'you@example.com');
   ```

Admins sign in at `/admin` with their email and password.

## 3. Connect GitHub to Supabase (automatic deploys)

Every push to `main` runs `.github/workflows/deploy.yml`, which deploys the server functions to Supabase and the website to GitHub Pages.

1. Supabase → your avatar → **Account preferences → Access Tokens** → **Generate new token**. Copy it.
2. GitHub repo → **Settings → Secrets and variables → Actions**:
   - **Secrets** tab → New repository secret: `SUPABASE_ACCESS_TOKEN` = the token.
   - **Variables** tab → add:
     - `SUPABASE_PROJECT_REF` – the ID in your project's address (`supabase.com/dashboard/project/<this part>`)
     - `SITE_URL` – the website address, e.g. `https://roboy2911.github.io/nyc-barbershop`
     - `VITE_SUPABASE_URL` – Supabase **Project Settings → API** (or Data API) → Project URL
     - `VITE_SUPABASE_ANON_KEY` – Supabase **Project Settings → API Keys** → the **publishable** key (or legacy **anon public** key)
     - `BASE_PATH` – only when using a custom domain: set to `/`
3. GitHub → **Actions → Deploy → Run workflow**.

The project URL and publishable/anon key are safe to be public – the database rules only let them read opening hours, barbers and free times, never customer details.

## 4. Emails (Resend) – after the domain is registered

1. Sign up at **resend.com** → **Domains → Add domain** → `nycbarbershop.com.au` → add the DNS records it shows in VentraIP → wait for "Verified".
2. **API Keys → Create** → copy the key.
3. Supabase → **Edge Functions → Secrets** → add `RESEND_API_KEY` = the key and `EMAIL_FROM` = `NYC Barbershop <bookings@nycbarbershop.com.au>`.
4. For password-reset emails: Supabase **Authentication → Emails → SMTP Settings** → host `smtp.resend.com`, port 465, user `resend`, password = the API key.

Until then bookings still work, but customers won't get confirmation emails (Supabase's built-in password-reset email still works, limited to a few per hour).

## 5. Custom domain

GitHub repo **Settings → Pages → Custom domain** → `nycbarbershop.com.au`, add the DNS records GitHub shows in VentraIP, tick **Enforce HTTPS**. Then set the `BASE_PATH` variable to `/`, update `SITE_URL` and the Supabase URL settings to the new address, and re-run the Deploy workflow.

---

## Automatic jobs (GitHub Actions)

- **Hourly jobs** – sends reminder emails about 24 hours before each appointment (once emails are set up) and keeps the free Supabase project from pausing.
- **Weekly backup** – every Monday at 3:23 am it saves a password-protected copy of all data. Turn it on by adding a secret named `BACKUP_PASSWORD` (repo **Settings → Secrets and variables → Actions → Secrets**). Pick a long password and store it somewhere safe – without it the backups can't be opened.
  - Download: repo **Actions → Weekly backup →** pick a run **→ Artifacts**. Backups are kept for 90 days.
  - Open one (Mac/Linux terminal, or Git Bash on Windows):
    ```bash
    unzip nyc-barbershop-backup-*.zip
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in nyc-barbershop-backup-*.tgz.enc -out backup.tgz
    tar xzf backup.tgz   # gives one .json file per table
    ```
- An admin can also download an (unencrypted) backup any time from **Admin → Settings → Download backup now**.

## How the admin page is protected

- Login is handled by Supabase: passwords are stored hashed, never in the website code.
- The database itself refuses changes unless the request comes from someone signed in who is in the `admins` table – so even someone who finds the admin page, or the site's code, can't change anything.
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
