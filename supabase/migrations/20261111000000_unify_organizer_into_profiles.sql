-- ============================================================
-- Unify organizer fields into profiles (GE-12 / FR-ORG)
-- Decision: single profiles table + single profile form.
-- App code must read/write organizer fields on profiles only.
-- organizer_profiles is left empty and deprecated (not dropped —
-- events.organizer_id historically referenced it; FK is retargeted).
-- ============================================================

-- ---------- 1. Add organizer columns to profiles ----------
alter table profiles
  add column if not exists org_name            text,
  add column if not exists org_type            organizer_type,
  add column if not exists venue_name          text,
  add column if not exists social_link         text,
  add column if not exists proof_note          text,
  add column if not exists verification_status verification_status,
  add column if not exists verified_at         timestamptz,
  add column if not exists verified_by         uuid references profiles(id),
  add column if not exists rejection_reason    text;

comment on column profiles.org_name is
  'Organizer organization name (FR-ORG-01). Null for non-organizers or incomplete organizers.';
comment on column profiles.verification_status is
  'Organizer verification (FR-ORG-02). Null until organizer submits org fields; then pending/approved/rejected.';

-- ---------- 2. Backfill from organizer_profiles ----------
update profiles p
set
  org_name            = op.org_name,
  org_type            = op.org_type,
  venue_name          = op.venue_name,
  social_link         = op.social_link,
  proof_note          = op.proof_note,
  verification_status = op.verification_status,
  verified_at         = op.verified_at,
  verified_by         = op.verified_by,
  rejection_reason    = op.rejection_reason
from organizer_profiles op
where op.user_id = p.id;

-- ---------- 3. Retarget events.organizer_id → profiles(id) ----------
-- Find and drop the existing FK (name may vary).
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'events'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'organizer_id'
  limit 1;

  if fk_name is not null then
    execute format('alter table events drop constraint %I', fk_name);
  end if;
end $$;

alter table events
  add constraint events_organizer_id_fkey
  foreign key (organizer_id) references profiles(id) on delete cascade;

-- ---------- 4. Move verification guard onto profiles ----------
drop trigger if exists guard_organizer_verification on organizer_profiles;

create or replace function guard_organizer_verification() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin()
     and (new.verification_status, new.verified_at, new.verified_by, new.rejection_reason)
         is distinct from
         (old.verification_status, old.verified_at, old.verified_by, old.rejection_reason) then
    raise exception 'Only an admin can change verification fields';
  end if;
  return new;
end $$;

drop trigger if exists guard_organizer_verification on profiles;
create trigger guard_organizer_verification
  before update on profiles
  for each row execute function guard_organizer_verification();

-- ---------- 5. Public directory view (approved organizers, no phone) ----------
-- FR-ORG-03: approved organizer org fields are publicly readable.
-- Kept as a view so phone / other profile PII stay behind profiles RLS.
create or replace view organizer_directory
  with (security_invoker = false)
as
select
  id as user_id,
  org_name,
  org_type,
  venue_name,
  social_link,
  proof_note,
  verification_status
from profiles
where role = 'organizer'
  and verification_status = 'approved';

grant select on organizer_directory to anon, authenticated;

comment on view organizer_directory is
  'Public-safe approved organizer fields (no phone). Prefer this over selecting profiles for sponsor-facing org info.';

-- ---------- 6. Deprecate organizer_profiles ----------
-- Empty the table after backfill. Keep structure so any lingering refs do not
-- explode; app code must not use this table.
delete from organizer_profiles;

comment on table organizer_profiles is
  'DEPRECATED (2026-11-11). Organizer fields live on profiles. Table kept empty; do not write new rows. Prefer profiles + organizer_directory.';

-- Revoke write paths so new code cannot accidentally insert.
drop policy if exists organizers_insert on organizer_profiles;
drop policy if exists organizers_update on organizer_profiles;
-- Keep select for emergency reads of any residual rows (should be empty).
