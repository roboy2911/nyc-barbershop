// Applies any new files in supabase/migrations to the live database, in order.
// Runs in GitHub Actions using the Supabase Management API.
// Needs SUPABASE_ACCESS_TOKEN and PROJECT_REF.
import { readdirSync, readFileSync } from 'node:fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.PROJECT_REF;
if (!token || !ref) {
  console.log('No Supabase token/project set – skipping migrations.');
  process.exit(0);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

await sql(`create table if not exists public.schema_migrations (
  name text primary key, applied_at timestamptz not null default now());
  alter table public.schema_migrations enable row level security;`);

const done = new Set((await sql('select name from public.schema_migrations')).map((r) => r.name));

// 001 was run by hand in the SQL editor – record it if its tables already exist.
if (!done.has('001_init.sql')) {
  const [row] = await sql(`select to_regclass('public.bookings') is not null as exists`);
  if (row?.exists) {
    await sql(`insert into public.schema_migrations (name) values ('001_init.sql') on conflict do nothing`);
    done.add('001_init.sql');
    console.log('Recorded 001_init.sql (already applied by hand).');
  }
}

const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  if (done.has(f)) continue;
  console.log(`Applying ${f}…`);
  const body = readFileSync(`supabase/migrations/${f}`, 'utf8');
  await sql(`begin;\n${body}\ninsert into public.schema_migrations (name) values ('${f}');\ncommit;`);
}
console.log('Database is up to date.');
