-- ============================================================
-- Stage 1 decisions migration (10 Nov 2026)
-- Implements all Required Schema Changes from docs/srs-stage1.md.
-- The base migration (20261109000000_stage1_schema.sql) is NOT edited.
--
-- Designed to be fully idempotent: safe to re-run in the SQL Editor
-- after a partial execution.
-- ============================================================

-- ---------- Extensions needed for scheduled overdue alerts (FR-ADM-14) ----------
-- pg_cron runs the hourly job; pg_net lets it call the Edge Function.
-- Wiring the Edge Function body is a separate task.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ============================================================
-- 1. Enum additions
-- ============================================================

-- BR-13: one super admin; can do everything an admin can, plus manage admin accounts
-- and fee settings. Wrapped in DO block so re-running after a partial execution
-- does not raise ERROR 42710: enum label already exists.
do $$ begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'super_admin'
      and enumtypid = 'user_role'::regtype
  ) then
    alter type user_role add value 'super_admin';
  end if;
end $$;

-- ============================================================
-- 2. profiles additions
-- ============================================================

-- BR-16: support permission — a super admin can grant any admin the ability to
-- correct payment errors (refund platform_fees for payment mistakes).
alter table profiles
  add column if not exists is_support boolean not null default false;

-- ============================================================
-- 3. platform_fees additions (BR-11, BR-12, idempotent webhooks)
-- ============================================================

-- paid_at: set by webhook on payment.captured; used for the 48-hour review timer (BR-12)
-- base_paise / gst_paise: split for receipts (BR-11 and FR-FEE-05)
-- amount_paise already exists (total charged = base + gst for subscriptions; fixed 10 000 for listings)
alter table platform_fees
  add column if not exists base_paise           bigint,
  add column if not exists gst_paise            bigint,
  add column if not exists paid_at              timestamptz,
  add column if not exists review_alert_sent_at timestamptz;

-- Idempotent webhooks: a repeated payment.captured event must never insert twice.
create unique index if not exists fees_gateway_order_id_uniq
  on platform_fees (gateway_order_id)
  where gateway_order_id is not null;

create unique index if not exists fees_gateway_payment_id_uniq
  on platform_fees (gateway_payment_id)
  where gateway_payment_id is not null;

-- One paid listing fee per event (BR-10 / FR-FEE-01).
-- This prevents a second payment row if something goes wrong.
create unique index if not exists fees_one_paid_listing_per_event
  on platform_fees (event_id)
  where fee_type = 'event_listing' and status = 'paid';

-- ============================================================
-- 4. events addition (FR-EVT-09)
-- ============================================================

-- Optional government authority letter. PDF stored in a private bucket.
-- NULL = no letter uploaded. Admin queue flags events with NULL (FR-ADM-13).
alter table events
  add column if not exists authority_letter_path text;

-- ============================================================
-- 5. Updated helper functions
-- ============================================================

-- is_admin() now returns true for both admin and super_admin (BR-13).
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('admin', 'super_admin'), false);
$$;

-- is_super_admin() guards admin-account management and fee settings.
create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'super_admin', false);
$$;

-- ============================================================
-- 6. Updated guard triggers
-- ============================================================

-- guard_profile_role: extended for super_admin rules.
-- Rules:
--   a) Nobody can self-assign admin or super_admin at runtime (signup trigger handles
--      the initial row; after that only server/super-admin paths apply).
--   b) Only the super admin can grant or remove the admin role.
--   c) The admin role can never be changed to super_admin and vice versa through this path.
--   d) Only the super admin can change is_support on any row.
--   e) auth.uid() IS NULL means the service role / SQL editor — always allowed.
create or replace function guard_profile_role() returns trigger language plpgsql as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Block changes to is_support unless the caller is the super admin
  if new.is_support is distinct from old.is_support and not is_super_admin() then
    raise exception 'Only the super admin can change the support permission';
  end if;

  -- Block role changes unless:
  --   • caller is the super admin (can promote/demote admin), OR
  --   • the role is not changing
  if new.role is distinct from old.role then
    if new.role = 'super_admin' or old.role = 'super_admin' then
      raise exception 'The super admin role can only be assigned directly in the database';
    end if;
    if new.role = 'admin' or old.role = 'admin' then
      if not is_super_admin() then
        raise exception 'Only the super admin can grant or remove the admin role';
      end if;
    else
      -- organizer / sponsor / general changes — block for non-admins as before
      if not is_admin() then
        raise exception 'Only an admin can change a role';
      end if;
    end if;
  end if;

  return new;
end $$;

-- guard_event_status: draft → pending_review now requires a paid listing fee (BR-03 updated).
-- Rejected → pending_review is allowed without a new fee (BR-14).
create or replace function guard_event_status() returns trigger language plpgsql as $$
begin
  -- Service role and admin bypass all status checks
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    -- draft → pending_review: fee must be paid already (webhook does this transition)
    if old.status = 'draft' and new.status = 'pending_review' then
      if not exists (
        select 1 from platform_fees
        where event_id = new.id
          and fee_type = 'event_listing'
          and status = 'paid'
      ) then
        raise exception 'Listing fee must be paid before submitting for review';
      end if;

    -- rejected → pending_review: allowed without a new fee (BR-14)
    elsif old.status = 'rejected' and new.status = 'pending_review' then
      null; -- allowed

    -- cancellation: organizer can cancel draft, pending_review, or published
    elsif new.status = 'cancelled'
      and old.status in ('draft', 'pending_review', 'published') then
      null; -- allowed

    else
      raise exception 'Status change from % to % is not allowed', old.status, new.status;
    end if;
  end if;

  return new;
end $$;

-- Unique partial index: exactly one super_admin profile (BR-13)
create unique index if not exists profiles_one_super_admin
  on profiles (role)
  where role = 'super_admin';

-- ============================================================
-- 7. settings table (FR-ADM-10, FR-FEE-06)
-- ============================================================

-- Drop any partially-created settings table from failed earlier runs.
-- This table has never held real data; dropping and recreating is safe.
drop table if exists settings cascade;

create table settings (
  id                     integer primary key default 1,
  listing_fee_paise      bigint not null default 10000,
  subscription_fee_paise bigint not null default 50000,
  gst_rate_pct           numeric(5,2) not null default 18.00,
  gstin                  text,
  launch_offer_text      text,
  updated_at             timestamptz not null default now(),
  constraint settings_single_row check (id = 1)
);

alter table settings enable row level security;

-- Authenticated users can read fee settings (needed to create Razorpay orders)
create policy "settings_select" on settings
  for select to authenticated using (true);

-- Only the super admin can write fee settings
create policy "settings_all_superadmin" on settings
  for all using (is_super_admin());

-- Seed the single settings row with confirmed Stage 1 values.
-- GST is included in the organizer's ₹100 (10 000 paise).
-- Sponsor subscription base is ₹500; GST is added on top, billed as ₹590.
insert into settings (id, listing_fee_paise, subscription_fee_paise, gst_rate_pct)
values (1, 10000, 50000, 18.00)
on conflict (id) do nothing;

-- ============================================================
-- 8. event_change_requests table (BR-15, FR-ADM-12, FR-EVT-10)
-- ============================================================

create table if not exists event_change_requests (
  id                       uuid primary key default gen_random_uuid(),
  event_id                 uuid not null references events(id) on delete cascade,
  proposed_fields          jsonb not null,   -- snapshot of proposed event-level changes
  proposed_packages        jsonb,            -- proposed package changes (null = no change)
  new_authority_letter_path text,            -- optional new letter submitted with the change
  status                   text not null default 'pending'
                             check (status in ('pending', 'approved', 'rejected')),
  rejection_reason         text,
  submitted_at             timestamptz not null default now(),
  reviewed_at              timestamptz,
  reviewed_by              uuid references profiles(id),
  review_alert_sent_at     timestamptz       -- tracks last overdue-alert send (FR-ADM-14)
);

-- Only one open change request per event at a time (BR-15)
create unique index if not exists event_change_requests_one_pending
  on event_change_requests (event_id)
  where status = 'pending';

alter table event_change_requests enable row level security;

-- The event's organizer can see and create change requests for their own events
drop policy if exists ecr_organizer_select on event_change_requests;
create policy ecr_organizer_select on event_change_requests
  for select using (
    exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid())
  );

drop policy if exists ecr_organizer_insert on event_change_requests;
create policy ecr_organizer_insert on event_change_requests
  for insert with check (
    exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid())
    and status = 'pending'
  );

-- Admins and super admins can read all change requests and update (approve/reject) them
drop policy if exists ecr_admin_select on event_change_requests;
create policy ecr_admin_select on event_change_requests
  for select using (is_admin());

drop policy if exists ecr_admin_update on event_change_requests;
create policy ecr_admin_update on event_change_requests
  for update using (is_admin()) with check (is_admin());

-- ============================================================
-- 9. RLS policy updates
-- ============================================================

-- events_update: organizers can no longer update a published event directly (BR-15).
-- They must submit an event_change_request instead.
drop policy if exists events_update on events;

create policy events_update on events
  for update
  using (
    (organizer_id = auth.uid() and status != 'published') or is_admin()
  )
  with check (
    (organizer_id = auth.uid() and status != 'published') or is_admin()
  );

-- interests_insert: sponsor must have an active subscription (FR-FEE-02 updated)
drop policy if exists interests_insert on interests;

create policy interests_insert on interests
  for insert with check (
    sponsor_id = auth.uid()
    and my_role() = 'sponsor'
    and exists (
      select 1 from events e where e.id = event_id and e.status = 'published'
    )
    and exists (
      select 1 from sponsor_profiles sp
      where sp.user_id = auth.uid()
        and sp.subscription_expires_at > now()
    )
  );

-- messages_insert: sender must be a sponsor with an active subscription OR the organizer
-- (organizers do not need a subscription to reply in their own threads)
drop policy if exists messages_insert on messages;

create policy messages_insert on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from interests i where i.id = interest_id
    )
    and (
      -- organizer side of the thread — no subscription required
      exists (
        select 1
        from interests i
        join events e on e.id = i.event_id
        where i.id = interest_id
          and e.organizer_id = auth.uid()
      )
      or
      -- sponsor side — active subscription required
      (
        my_role() = 'sponsor'
        and exists (
          select 1 from sponsor_profiles sp
          where sp.user_id = auth.uid()
            and sp.subscription_expires_at > now()
        )
      )
    )
  );
