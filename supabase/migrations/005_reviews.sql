-- Reviews shown on the website, managed in Admin -> Reviews.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  stars int not null default 5 check (stars between 1 and 5),
  text text not null check (char_length(text) between 1 and 600),
  visible boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy "public read visible" on public.reviews for select using (visible or public.is_admin());
create policy "admin write" on public.reviews for all using (public.is_admin()) with check (public.is_admin());

-- Start with the placeholder reviews that were on the site.
insert into public.reviews (name, stars, text, sort) values
  ('Placeholder Customer', 5, 'Placeholder review – best fade I have had on the Gold Coast. Friendly crew and always on time.', 0),
  ('Placeholder Customer', 5, 'Placeholder review – booked online, walked straight in to the chair. Beard has never looked better.', 1),
  ('Placeholder Customer', 5, 'Placeholder review – great with my kids, patient and the cuts are spot on every time.', 2),
  ('Placeholder Customer', 5, 'Placeholder review – clean shop, good chat, sharp line up. Will be back in two weeks.', 3),
  ('Placeholder Customer', 5, 'Placeholder review – walked in on a Thursday night and got looked after straight away.', 4),
  ('Placeholder Customer', 5, 'Placeholder review – Tom and John know exactly what they are doing. Highly recommend.', 5);
