-- Profile photos, customer photos/logos, and the optional gradient ring
-- around the authenticated user's own avatar.
--
-- profiles.avatar_url and business_profiles.logo_url already exist
-- (0001_phase2b_schema.sql) and already round-trip through the app's
-- profileStore -- only a real upload UI was missing, not schema. This
-- migration adds what's genuinely new: a constrained identifier for the
-- user's optional gradient ring, and image support on customers (which had
-- none at all before this).

-- A fixed, stable set of ring identifiers -- never an arbitrary gradient
-- CSS/color string, so the check constraint is the actual enforcement of
-- "premium and restrained," not just a client-side convention.
alter table public.profiles
  add column if not exists avatar_border_style text not null default 'none'
    check (avatar_border_style in ('none', 'lime', 'aurora', 'sunset', 'ocean', 'violet'));

-- Customers had no image column at all. avatar_url mirrors the existing
-- profiles.avatar_url naming. image_type distinguishes an individual's
-- photo (circular, cover-cropped) from a business logo (square,
-- contain-fit, not aggressively cropped) purely for rendering -- it does
-- not affect ownership or security.
alter table public.customers
  add column if not exists avatar_url text,
  add column if not exists image_type text
    check (image_type is null or image_type in ('photo', 'logo'));

-- Single shared bucket for every avatar/logo asset in the app, as
-- suggested: one dedicated bucket keeps ownership policies below simple
-- and uniform instead of one bucket per table. `public: true` means
-- objects are readable by anyone with the URL (matching an ordinary
-- avatar/logo -- a low-sensitivity, commonly-shared-by-URL kind of asset,
-- not financial data) -- write access below is the actual security
-- boundary, scoped per-owner exactly like every other table in this
-- project.
--
-- allowed_mime_types/file_size_limit: the insert/update policies below
-- only check *who* is writing (via the path's owner-id segment), not
-- *what* -- without a bucket-level constraint, an authenticated user could
-- publicly host arbitrary files/sizes under their own id. The client only
-- ever uploads a 512x512 JPEG it just produced (avatarUpload.ts), so 5MB
-- and image/jpeg+png is generous headroom, not a tight fit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Paths are always `<users|customers>/<owner-user-id>/...`, so the owner's
-- id is always the SECOND path segment for both shapes:
--   users/<user-id>/<filename>
--   customers/<owner-user-id>/<customer-id>/<filename>
-- storage.foldername(name) returns every path segment except the filename
-- itself, e.g. {'users','<user-id>'} or {'customers','<owner-user-id>','<customer-id>'}.
-- Reads are public (bucket-wide); writes require auth.uid() to match that
-- second segment, so a user can never write into another user's profile
-- path or another user's customer's path, regardless of that customer's
-- id.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);
