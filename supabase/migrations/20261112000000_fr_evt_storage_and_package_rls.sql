-- FR-EVT: authority-letter storage + package write lock on published events (BR-15)
-- Never edit applied migrations; this file is additive only.

-- ============================================================
-- 1. Private storage bucket for government authority letters (FR-EVT-09)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-documents',
  'event-documents',
  false,
  5242880, -- 5 MB
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {organizer_id}/{event_id}/{filename}.pdf
-- Organizer may upload/update/read/delete objects under their own uid prefix
-- when they own the event and it is draft or rejected (edits on published go
-- through change requests; new letter path is uploaded under the same prefix).

drop policy if exists event_documents_organizer_select on storage.objects;
create policy event_documents_organizer_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-documents'
    and (
      is_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and exists (
          select 1 from events e
          where e.id::text = (storage.foldername(name))[2]
            and e.organizer_id = auth.uid()
        )
      )
    )
  );

drop policy if exists event_documents_organizer_insert on storage.objects;
create policy event_documents_organizer_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[2]
        and e.organizer_id = auth.uid()
        and e.status in ('draft', 'rejected', 'published')
    )
  );

drop policy if exists event_documents_organizer_update on storage.objects;
create policy event_documents_organizer_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'event-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[2]
        and e.organizer_id = auth.uid()
        and e.status in ('draft', 'rejected', 'published')
    )
  )
  with check (
    bucket_id = 'event-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists event_documents_organizer_delete on storage.objects;
create policy event_documents_organizer_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-documents'
    and (
      is_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and exists (
          select 1 from events e
          where e.id::text = (storage.foldername(name))[2]
            and e.organizer_id = auth.uid()
            and e.status in ('draft', 'rejected')
        )
      )
    )
  );

-- ============================================================
-- 2. sponsorship_packages: organizers cannot write when published (BR-15)
-- ============================================================

drop policy if exists packages_write on sponsorship_packages;

create policy packages_write on sponsorship_packages
  for all
  using (
    is_admin()
    or exists (
      select 1 from events e
      where e.id = event_id
        and e.organizer_id = auth.uid()
        and e.status in ('draft', 'rejected')
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from events e
      where e.id = event_id
        and e.organizer_id = auth.uid()
        and e.status in ('draft', 'rejected')
    )
  );
