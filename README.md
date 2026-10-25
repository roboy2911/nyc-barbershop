# NYC Barbershop website

Website and online booking for NYC Barbershop, Coomera East Shopping Centre.

- **Demo:** https://roboy2911.github.io/nyc-barbershop/ (admin at `/admin`, password `demo1234`, any 6-digit code)
- **Going live:** see [SETUP.md](SETUP.md)

## Run locally
```bash
npm install
npm run dev
```

## Structure
- `src/pages` – public pages (Home, Services, Book, Reviews, Contact, Cancel)
- `src/pages/admin` – admin page
- `src/lib` – data layer (`demoBackend` in the browser, `supabaseBackend` when live)
- `supabase/migrations` – database tables and security rules
- `supabase/functions` – server functions (bookings, cancellations, admin actions, emails)
- `supabase/functions/_shared/availability.js` – booking rules shared by the site and server
