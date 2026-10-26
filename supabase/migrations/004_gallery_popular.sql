-- Photo gallery the owner can upload to, and a "Most popular" flag for services.

alter table public.services add column if not exists popular boolean not null default false;
update public.services set popular = true where name = 'Haircut' and not exists (select 1 from public.services where popular);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  path text not null,          -- full-size image in the "gallery" storage bucket
  thumb_path text not null,    -- smaller copy for the grid
  caption text check (char_length(caption) <= 140),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.gallery_photos enable row level security;
create policy "public read" on public.gallery_photos for select using (true);
create policy "admin write" on public.gallery_photos for all using (public.is_admin()) with check (public.is_admin());

-- Public image bucket: anyone can view, only admins can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "gallery admin upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_admin());
create policy "gallery admin update" on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and public.is_admin());
create policy "gallery admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_admin());
