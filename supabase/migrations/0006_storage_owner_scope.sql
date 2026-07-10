-- Scope storage write access to the uploader's own folder.
--
-- Fixes (see AUDIT.md §1.4): "media auth update/delete" let ANY authenticated
-- user overwrite or delete ANY file in the bucket, because the check was only
-- `bucket_id = 'media'`. Uploads always go to `<folder>/<uid>/<uuid>.<ext>`
-- (frontend/src/services/api/storage.ts), so the uid is the 2nd path segment
-- — scope update/delete to callers whose auth.uid() matches it. Insert gets
-- the same scoping so a signed-in user can't plant files under someone else's
-- uid folder in the first place.

drop policy if exists "media auth insert" on storage.objects;
create policy "media auth insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "media auth update" on storage.objects;
create policy "media auth update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "media auth delete" on storage.objects;
create policy "media auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);
