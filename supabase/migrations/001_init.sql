-- NYC Barbershop database. Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------- admins
-- Only users listed here (and signed in with their 2FA code) can change anything.
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- ---------------------------------------------------------------- shop setup
create table public.settings (
  id int primary key default 1 check (id = 1),
  max_concurrent int check (max_concurrent > 0),   -- null = one per working barber
  booking_window_days int not null default 30 check (booking_window_days between 1 and 365),
  cutoff_minutes int not null default 30 check (cutoff_minutes between 0 and 1440),
  slot_step int not null default 15 check (slot_step in (5, 10, 15, 20, 30, 60)),
  public_email text,
  phone text,
  banner text
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 80),
  duration_min int not null check (duration_min between 5 and 480),
  price_cents int check (price_cents >= 0),
  description text,
  sort int not null default 0,
  active boolean not null default true
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 60),
  removed boolean not null default false,
  sort int not null default 0
);

create table public.weekly_hours (
  dow int primary key check (dow between 0 and 6),  -- 0 = Sunday
  closed boolean not null default false,
  open_min int check (open_min between 0 and 1440),
  close_min int check (close_min between 0 and 1440)
);

create table public.special_days (
  date date primary key,
  closed boolean not null default false,
  open_min int check (open_min between 0 and 1440),
  close_min int check (close_min between 0 and 1440),
  note text
);

create table public.barber_unavailability (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers on delete cascade,
  start_date date not null,
  end_date date,          -- null = until turned back on
  reason text,
  created_at timestamptz not null default now()
);

create table public.breaks (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers on delete cascade,
  start_date date not null,
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440 and end_min > start_min),
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly')),
  repeat_days int[] not null default '{}',
  repeat_until date,
  label text
);

-- ---------------------------------------------------------------- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid,
  barber_id uuid not null references public.barbers,
  service_id uuid references public.services on delete set null,
  service_name text not null,
  booking_date date not null,
  start_min int not null,
  end_min int not null check (end_min > start_min),
  customer_name text not null check (char_length(customer_name) <= 100),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  guest_name text,
  notes text,
  source text not null default 'online' check (source in ('online', 'admin')),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancel_token uuid not null default gen_random_uuid() unique,
  cancel_reason text,
  cancelled_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A barber can never be double-booked, even if two people click at the same moment.
  constraint no_double_booking exclude using gist (
    barber_id with =, booking_date with =, int4range(start_min, end_min) with &&
  ) where (status = 'confirmed')
);
create index bookings_date_idx on public.bookings (booking_date);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 30),
  message text not null check (char_length(message) between 1 and 3000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- security rules
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.weekly_hours enable row level security;
alter table public.special_days enable row level security;
alter table public.barber_unavailability enable row level security;
alter table public.breaks enable row level security;
alter table public.bookings enable row level security;
alter table public.contact_messages enable row level security;

create policy "see own admin row" on public.admins for select using (user_id = auth.uid());

-- Shop setup is public to read, admin-only to change.
do $$
declare t text;
begin
  foreach t in array array['settings','services','barbers','weekly_hours','special_days','barber_unavailability','breaks'] loop
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('create policy "admin write" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Customer details are admin-only. The public booking page uses get_busy() below,
-- which reveals only which times are taken, never who booked them.
create policy "admin all" on public.bookings for all using (public.is_admin()) with check (public.is_admin());

create policy "anyone can send" on public.contact_messages for insert with check (handled = false);
create policy "admin read" on public.contact_messages for select using (public.is_admin());
create policy "admin update" on public.contact_messages for update using (public.is_admin());
create policy "admin delete" on public.contact_messages for delete using (public.is_admin());

create or replace function public.get_busy(from_date date, to_date date)
returns table (barber_id uuid, booking_date date, start_min int, end_min int)
language sql stable security definer set search_path = public as $$
  select barber_id, booking_date, start_min, end_min
  from public.bookings
  where status = 'confirmed'
    and booking_date between from_date and to_date
    and to_date - from_date <= 62;
$$;
revoke all on function public.get_busy(date, date) from public;
grant execute on function public.get_busy(date, date) to anon, authenticated;

-- ---------------------------------------------------------------- starting data
insert into public.settings (id, booking_window_days, cutoff_minutes, slot_step, public_email, phone)
values (1, 30, 30, 15, 'placeholder@nycbarbershop.com.au', '0410 823 773');

insert into public.services (name, duration_min, price_cents, description, sort) values
  ('Haircut', 35, 3500, 'Placeholder description – classic cut, fade or scissor work, finished and styled.', 1),
  ('Beard', 25, 2500, 'Placeholder description – beard shape, line and trim.', 2),
  ('Haircut & Beard', 45, 5500, 'Placeholder description – the full works.', 3),
  ('Line Up', 15, 1500, 'Placeholder description – sharp edges between cuts.', 4);

insert into public.barbers (name, sort) values ('Tom', 1), ('John', 2);

insert into public.weekly_hours (dow, closed, open_min, close_min) values
  (0, false, 600, 960),   -- Sunday 10am-4pm
  (1, false, 540, 1050),  -- Monday 9am-5:30pm
  (2, false, 540, 1050),
  (3, false, 540, 1050),
  (4, false, 540, 1260),  -- Thursday 9am-9pm
  (5, false, 540, 1050),
  (6, false, 540, 960);   -- Saturday 9am-4pm
