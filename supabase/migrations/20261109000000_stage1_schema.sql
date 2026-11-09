-- ============================================================
-- Event Sponsorship Marketplace: Stage 1 schema
-- Target: Supabase (Postgres). Money is stored in paise (integer).
-- Stage 1 = organizer and sponsor signup, listings with packages,
-- browse and filters, interest, chat, admin approval, small platform fees.
-- Ticketing, deals, reviews and instalments (Stage 2 and 3) are NOT here,
-- except the `ticketing` column on events, reserved for Stage 2.
-- First-pass RLS: review every policy before going live.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role           as enum ('organizer', 'sponsor', 'general', 'admin');
create type verification_status as enum ('pending', 'approved', 'rejected');
create type organizer_type      as enum ('society', 'club', 'company', 'other');
create type sponsor_plan        as enum ('basic', 'premium');
create type event_visibility    as enum ('public', 'private');
create type ticketing_mode      as enum ('none', 'ticketed');
create type event_status        as enum ('draft', 'pending_review', 'published', 'rejected', 'cancelled', 'completed');
create type interest_status     as enum ('new', 'contacted', 'in_discussion', 'closed', 'declined');
create type fee_type            as enum ('event_listing', 'sponsor_subscription');
create type fee_status          as enum ('pending', 'paid', 'failed', 'refunded');

-- ---------- Lookup tables (add a city or event type = add a row) ----------
create table cities (
  id         serial primary key,
  name       text not null,
  state      text not null,
  is_active  boolean not null default true,
  unique (name, state)
);

create table event_types (
  id    serial primary key,
  slug  text not null unique,
  name  text not null
);

-- ---------- Users ----------
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                user_role not null default 'general',
  full_name           text,
  phone               text,
  city_id             int references cities(id),
  preferred_language  text not null default 'en' check (preferred_language in ('en', 'hi', 'gu')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table organizer_profiles (
  user_id             uuid primary key references profiles(id) on delete cascade,
  org_name            text not null,
  org_type            organizer_type not null default 'society',
  venue_name          text,
  social_link         text,
  proof_note          text,  -- link or note for a past event photo
  verification_status verification_status not null default 'pending',
  verified_at         timestamptz,
  verified_by         uuid references profiles(id),
  rejection_reason    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table sponsor_profiles (
  user_id                   uuid primary key references profiles(id) on delete cascade,
  company_name              text not null,
  industry                  text,
  budget_min_paise          bigint check (budget_min_paise is null or budget_min_paise >= 0),
  budget_max_paise          bigint,
  target_city_ids           int[] not null default '{}',
  plan                      sponsor_plan not null default 'basic',  -- Stage 1: basic only
  subscription_expires_at   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (budget_max_paise is null or budget_min_paise is null or budget_max_paise >= budget_min_paise)
);

-- ---------- Events and packages ----------
create table events (
  id                uuid primary key default gen_random_uuid(),
  organizer_id      uuid not null references organizer_profiles(user_id) on delete cascade,
  title             text not null,
  description       text,
  event_type_id     int not null references event_types(id),
  city_id           int not null references cities(id),
  venue             text,
  season            text,  -- free tag such as 'navratri-2027', used as a filter
  start_date        date not null,
  end_date          date not null,
  expected_audience int check (expected_audience is null or expected_audience >= 0),
  audience_notes    text,
  visibility        event_visibility not null default 'public',
  ticketing         ticketing_mode not null default 'none',  -- reserved for Stage 2
  status            event_status not null default 'draft',
  rejection_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date >= start_date),
  check (ticketing = 'none' or visibility = 'public')
);

create table sponsorship_packages (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  name          text not null,
  price_paise   bigint not null check (price_paise >= 0),
  deliverables  text,
  slots_total   int check (slots_total is null or slots_total > 0),
  created_at    timestamptz not null default now()
);

-- ---------- Sponsor interest and chat ----------
create table interests (
  id              uuid primary key default gen_random_uuid(),
  sponsor_id      uuid not null references sponsor_profiles(user_id) on delete cascade,
  event_id        uuid not null references events(id) on delete cascade,
  package_id      uuid references sponsorship_packages(id) on delete set null,
  message         text,
  status          interest_status not null default 'new',
  contact_shared  boolean not null default false,  -- phone numbers shared only after this is true (enforce in app/API)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index interests_unique_idx
  on interests (sponsor_id, event_id, coalesce(package_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table messages (
  id          uuid primary key default gen_random_uuid(),
  interest_id uuid not null references interests(id) on delete cascade,
  sender_id   uuid not null references profiles(id),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

-- ---------- Platform fees (Stage 1 listing fee and sponsor subscription) ----------
create table platform_fees (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id),
  event_id            uuid references events(id) on delete set null,
  fee_type            fee_type not null,
  amount_paise        bigint not null check (amount_paise >= 0),
  status              fee_status not null default 'pending',
  gateway_order_id    text,
  gateway_payment_id  text,
  refund_reason       text,  -- e.g. listing rejected by the platform
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- Admin audit log ----------
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id),
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Indexes ----------
create index events_browse_idx   on events (status, visibility, city_id, event_type_id, start_date);
create index events_organizer_idx on events (organizer_id);
create index packages_event_idx  on sponsorship_packages (event_id);
create index interests_event_idx on interests (event_id);
create index interests_sponsor_idx on interests (sponsor_id);
create index messages_thread_idx on messages (interest_id, created_at);
create index fees_user_idx       on platform_fees (user_id);

-- ---------- Helpers ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','organizer_profiles','sponsor_profiles','events','interests','platform_fees']
  loop
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'admin', false);
$$;

-- Create a profile row when a user signs up. Role comes from signup metadata,
-- but 'admin' can never be self-assigned.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := new.raw_user_meta_data->>'role';
begin
  insert into profiles (id, role, full_name, phone)
  values (
    new.id,
    case when r in ('organizer', 'sponsor', 'general') then r::user_role else 'general' end,
    new.raw_user_meta_data->>'full_name',
    new.phone
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Guard triggers (users must not change sensitive columns) ----------
-- auth.uid() is null for the service role and SQL editor, so those are allowed.

create or replace function guard_profile_role() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role and not is_admin() then
    raise exception 'Only an admin can change a role';
  end if;
  return new;
end $$;
create trigger guard_profile_role before update on profiles
  for each row execute function guard_profile_role();

create or replace function guard_organizer_verification() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin()
     and (new.verification_status, new.verified_at, new.verified_by, new.rejection_reason)
         is distinct from
         (old.verification_status, old.verified_at, old.verified_by, old.rejection_reason) then
    raise exception 'Only an admin can change verification fields';
  end if;
  return new;
end $$;
create trigger guard_organizer_verification before update on organizer_profiles
  for each row execute function guard_organizer_verification();

create or replace function guard_sponsor_plan() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin()
     and (new.plan, new.subscription_expires_at) is distinct from (old.plan, old.subscription_expires_at) then
    raise exception 'Plan and subscription can only be changed by the platform';
  end if;
  return new;
end $$;
create trigger guard_sponsor_plan before update on sponsor_profiles
  for each row execute function guard_sponsor_plan();

-- Organizers may submit a draft or rejected event for review, or cancel it.
-- Publishing, rejecting and completing are admin or service-role actions.
-- Add a check here later that the listing fee is paid before submission.
create or replace function guard_event_status() returns trigger language plpgsql as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status then
    if not (
         (old.status in ('draft', 'rejected') and new.status = 'pending_review')
      or (old.status in ('draft', 'pending_review', 'published') and new.status = 'cancelled')
    ) then
      raise exception 'Status change from % to % is not allowed', old.status, new.status;
    end if;
  end if;
  return new;
end $$;
create trigger guard_event_status before update on events
  for each row execute function guard_event_status();

-- ---------- Row Level Security ----------
alter table cities               enable row level security;
alter table event_types          enable row level security;
alter table profiles             enable row level security;
alter table organizer_profiles   enable row level security;
alter table sponsor_profiles     enable row level security;
alter table events               enable row level security;
alter table sponsorship_packages enable row level security;
alter table interests            enable row level security;
alter table messages             enable row level security;
alter table platform_fees        enable row level security;
alter table audit_log            enable row level security;

-- Lookups: everyone reads, admin writes
create policy cities_read       on cities      for select using (true);
create policy cities_admin      on cities      for all using (is_admin()) with check (is_admin());
create policy event_types_read  on event_types for select using (true);
create policy event_types_admin on event_types for all using (is_admin()) with check (is_admin());

-- Profiles: own row or admin (rows are created by the signup trigger)
create policy profiles_select on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- Organizer profiles: approved organizers are public so sponsors can see who is behind a listing
create policy organizers_select on organizer_profiles for select
  using (user_id = auth.uid() or is_admin() or verification_status = 'approved');
create policy organizers_insert on organizer_profiles for insert
  with check (user_id = auth.uid() and my_role() = 'organizer' and verification_status = 'pending');
create policy organizers_update on organizer_profiles for update
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());

-- Sponsor profiles: own row, admin, or an organizer whose event they showed interest in
create policy sponsors_select on sponsor_profiles for select using (
  user_id = auth.uid() or is_admin()
  or exists (
    select 1 from interests i join events e on e.id = i.event_id
    where i.sponsor_id = sponsor_profiles.user_id and e.organizer_id = auth.uid()
  )
);
create policy sponsors_insert on sponsor_profiles for insert
  with check (user_id = auth.uid() and my_role() = 'sponsor' and plan = 'basic' and subscription_expires_at is null);
create policy sponsors_update on sponsor_profiles for update
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());

-- Events: published public events are visible to everyone (including logged-out visitors).
-- Published private events are visible to sponsors only. Owners and admins see their own.
create policy events_select on events for select using (
  (status = 'published' and (visibility = 'public' or my_role() = 'sponsor'))
  or organizer_id = auth.uid()
  or is_admin()
);
create policy events_insert on events for insert
  with check (organizer_id = auth.uid() and my_role() = 'organizer' and status = 'draft');
create policy events_update on events for update
  using (organizer_id = auth.uid() or is_admin()) with check (organizer_id = auth.uid() or is_admin());
create policy events_delete on events for delete
  using ((organizer_id = auth.uid() and status = 'draft') or is_admin());

-- Packages follow the visibility of their event; only the event's organizer or admin writes
create policy packages_select on sponsorship_packages for select
  using (exists (select 1 from events e where e.id = event_id));
create policy packages_write on sponsorship_packages for all
  using (exists (select 1 from events e where e.id = event_id and (e.organizer_id = auth.uid() or is_admin())))
  with check (exists (select 1 from events e where e.id = event_id and (e.organizer_id = auth.uid() or is_admin())));

-- Interests: the sponsor, the event's organizer, or admin
create policy interests_select on interests for select using (
  sponsor_id = auth.uid() or is_admin()
  or exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid())
);
create policy interests_insert on interests for insert with check (
  sponsor_id = auth.uid() and my_role() = 'sponsor'
  and exists (select 1 from events e where e.id = event_id and e.status = 'published')
);
create policy interests_update on interests for update using (
  sponsor_id = auth.uid() or is_admin()
  or exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid())
);

-- Messages: only the two parties of the interest (the subquery is itself filtered by interests RLS)
create policy messages_select on messages for select
  using (exists (select 1 from interests i where i.id = interest_id));
create policy messages_insert on messages for insert
  with check (sender_id = auth.uid() and exists (select 1 from interests i where i.id = interest_id));

-- Fees: users read their own; writes happen only through the service role (gateway webhooks) or admin
create policy fees_select on platform_fees for select using (user_id = auth.uid() or is_admin());
create policy fees_admin  on platform_fees for all using (is_admin()) with check (is_admin());

-- Audit log: admin only
create policy audit_admin on audit_log for all using (is_admin()) with check (is_admin());

-- ---------- Seed data ----------
insert into cities (name, state) values
  ('Ahmedabad', 'Gujarat'),
  ('Surat', 'Gujarat'),
  ('Vadodara', 'Gujarat'),
  ('Rajkot', 'Gujarat');

insert into event_types (slug, name) values
  ('navratri-garba', 'Navratri / Garba'),
  ('diwali-fair', 'Diwali Fair'),
  ('uttarayan', 'Uttarayan'),
  ('ganesh-utsav', 'Ganesh Utsav'),
  ('wedding-expo', 'Wedding Expo'),
  ('college-fest', 'College Fest'),
  ('cultural', 'Cultural Event'),
  ('corporate', 'Corporate Event');
