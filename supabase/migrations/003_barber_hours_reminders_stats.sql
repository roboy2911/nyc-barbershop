-- Barber working hours, reminder tracking and visitor stats.

-- ---------------------------------------------------------------- barber hours
-- One row per barber per weekday. No row = works whenever the shop is open.
create table if not exists public.barber_hours (
  barber_id uuid not null references public.barbers on delete cascade,
  dow int not null check (dow between 0 and 6),
  off boolean not null default false,
  start_min int check (start_min between 0 and 1440),
  end_min int check (end_min between 0 and 1440),
  primary key (barber_id, dow)
);
alter table public.barber_hours enable row level security;
create policy "public read" on public.barber_hours for select using (true);
create policy "admin write" on public.barber_hours for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- reminders
alter table public.bookings add column if not exists reminder_sent_at timestamptz;

-- ---------------------------------------------------------------- visitor stats
-- Anonymous page views: no names, no IP addresses, just a random id per browser.
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  viewed_at timestamptz not null default now(),
  day date not null default (now() at time zone 'Australia/Brisbane')::date,
  path text not null,
  referrer text,
  visitor text,
  device text
);
create index if not exists page_views_day_idx on public.page_views (day);
alter table public.page_views enable row level security;
-- No direct access; the website records views through track_view() below.

create or replace function public.track_view(p_path text, p_referrer text, p_visitor text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or p_path like '/admin%' then return; end if;
  insert into public.page_views (path, referrer, visitor, device)
  values (left(p_path, 100), nullif(left(coalesce(p_referrer, ''), 100), ''), left(p_visitor, 40), left(p_device, 10));
end $$;
revoke all on function public.track_view(text, text, text, text) from public;
grant execute on function public.track_view(text, text, text, text) to anon, authenticated;

-- Summary for the admin Stats tab (admins only).
create or replace function public.visit_stats(p_days int)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  since date := (now() at time zone 'Australia/Brisbane')::date - greatest(1, least(p_days, 400)) + 1;
  result json;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select json_build_object(
    'daily', (select coalesce(json_agg(d order by d.day), '[]') from (
        select day, count(*) as views, count(distinct visitor) as visitors
        from public.page_views where day >= since group by day) d),
    'pages', (select coalesce(json_agg(p), '[]') from (
        select path, count(*) as views from public.page_views where day >= since
        group by path order by count(*) desc limit 10) p),
    'referrers', (select coalesce(json_agg(r), '[]') from (
        select referrer, count(*) as views from public.page_views where day >= since and referrer is not null
        group by referrer order by count(*) desc limit 10) r),
    'devices', (select coalesce(json_agg(v), '[]') from (
        select coalesce(device, 'unknown') as device, count(distinct visitor) as visitors from public.page_views
        where day >= since group by 1 order by 2 desc) v),
    'visitors', (select count(distinct visitor) from public.page_views where day >= since),
    'views', (select count(*) from public.page_views where day >= since),
    'bookings', (select count(*) from public.bookings where source = 'online' and created_at >= since)
  ) into result;
  return result;
end $$;
revoke all on function public.visit_stats(int) from public;
grant execute on function public.visit_stats(int) to authenticated;
