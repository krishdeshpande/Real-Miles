-- Storage buckets setup for OwnerLog
insert into storage.buckets (id, name, public)
values 
  ('reviews', 'reviews', true),
  ('odometers', 'odometers', false),
  ('avatars', 'avatars', true),
  ('vehicle_heroes', 'vehicle_heroes', true)
on conflict (id) do nothing;

-- 1. Reviews media bucket policies (public read, auth user write)
create policy "Reviews media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'reviews');

create policy "Authenticated users can upload reviews media"
  on storage.objects for insert
  with check (bucket_id = 'reviews' and auth.role() = 'authenticated');

-- 2. Odometers bucket policies (private: owner or admin only)
create policy "Odometer photos readable only by owner or admin"
  on storage.objects for select
  using (
    bucket_id = 'odometers' and (
      (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
      or public.is_admin(auth.uid())
    )
  );

create policy "Authenticated users can upload odometer photos to their folder"
  on storage.objects for insert
  with check (
    bucket_id = 'odometers' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Avatars bucket policies
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- 4. Vehicle heroes bucket policies (public read, admin write)
create policy "Vehicle heroes are publicly readable"
  on storage.objects for select
  using (bucket_id = 'vehicle_heroes');

create policy "Admins can upload vehicle heroes"
  on storage.objects for insert
  with check (bucket_id = 'vehicle_heroes' and public.is_admin(auth.uid()));
