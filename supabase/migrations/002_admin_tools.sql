-- Admin tools: no-show tracking and faster customer search.
alter table public.bookings add column if not exists no_show boolean not null default false;
create index if not exists bookings_email_idx on public.bookings (lower(email));
create index if not exists bookings_phone_idx on public.bookings (phone);
create index if not exists bookings_name_idx on public.bookings (lower(customer_name));
