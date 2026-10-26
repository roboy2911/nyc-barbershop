-- Review request email the day after an appointment, plus email opt-outs.
alter table public.bookings add column if not exists review_request_sent_at timestamptz;
alter table public.settings add column if not exists review_requests boolean not null default true;
alter table public.settings add column if not exists google_review_url text
  default 'https://www.google.com/maps?cid=12498344011653964478'
  check (google_review_url is null or google_review_url ~ '^https://');
update public.settings set google_review_url = 'https://www.google.com/maps?cid=12498344011653964478'
  where id = 1 and google_review_url is null;

-- People who clicked "don't send me these emails".
create table if not exists public.email_optouts (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.email_optouts enable row level security;
create policy "admin read" on public.email_optouts for select using (public.is_admin());
create policy "admin delete" on public.email_optouts for delete using (public.is_admin());
