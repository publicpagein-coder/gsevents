# Database Design

Schema source: `supabase/migrations/` (base `20261109000000_stage1_schema.sql`, plus later migrations including unify-organizer-into-profiles).

## Enums

| Enum                  | Values                                                                       |
| --------------------- | ---------------------------------------------------------------------------- |
| `user_role`           | `organizer`, `sponsor`, `general`, `admin`                                   |
| `verification_status` | `pending`, `approved`, `rejected`                                            |
| `organizer_type`      | `society`, `club`, `company`, `other`                                        |
| `sponsor_plan`        | `basic`, `premium`                                                           |
| `event_visibility`    | `public`, `private`                                                          |
| `ticketing_mode`      | `none`, `ticketed`                                                           |
| `event_status`        | `draft`, `pending_review`, `published`, `rejected`, `cancelled`, `completed` |
| `interest_status`     | `new`, `contacted`, `in_discussion`, `closed`, `declined`                    |
| `fee_type`            | `event_listing`, `sponsor_subscription`                                      |
| `fee_status`          | `pending`, `paid`, `failed`, `refunded`                                      |

---

## Table Dictionary

### `cities`

| Column      | Type                            | Notes |
| ----------- | ------------------------------- | ----- |
| `id`        | `serial` PK                     |       |
| `name`      | `text` NOT NULL                 |       |
| `state`     | `text` NOT NULL                 |       |
| `is_active` | `boolean` NOT NULL DEFAULT true |       |
| —           | UNIQUE(`name`, `state`)         |       |

Seed data: Ahmedabad, Surat, Vadodara, Rajkot (all in Gujarat).

### `event_types`

| Column | Type                   | Notes |
| ------ | ---------------------- | ----- |
| `id`   | `serial` PK            |       |
| `slug` | `text` NOT NULL UNIQUE |       |
| `name` | `text` NOT NULL        |       |

Seed data: navratri-garba, diwali-fair, uttarayan, ganesh-utsav, wedding-expo, college-fest, cultural, corporate.

### `profiles`

| Column                      | Type                                   | Notes                                                                 |
| --------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `id`                        | `uuid` PK                              | References `auth.users(id)` ON DELETE CASCADE                         |
| `role`                      | `user_role` NOT NULL DEFAULT `general` | Guard trigger prevents self-change                                    |
| `full_name`                 | `text`                                 |                                                                       |
| `phone`                     | `text`                                 |                                                                       |
| `city_id`                   | `int`                                  | FK → `cities(id)`                                                     |
| `preferred_language`        | `text` NOT NULL DEFAULT `en`           | CHECK IN ('en','hi','gu')                                             |
| `is_support`                | `boolean` NOT NULL DEFAULT false       | Support permission (super admin only)                                 |
| `org_name`                  | `text`                                 | Organizer org name (FR-ORG-01). Null until submitted / non-organizers |
| `org_type`                  | `organizer_type`                       | Nullable; set when organizer submits                                  |
| `venue_name`                | `text`                                 |                                                                       |
| `social_link`               | `text`                                 |                                                                       |
| `proof_note`                | `text`                                 | Link or note for a past event photo                                   |
| `verification_status`       | `verification_status`                  | Null until org fields submitted; then pending/approved/rejected       |
| `verified_at`               | `timestamptz`                          | Set by admin on approval                                              |
| `verified_by`               | `uuid`                                 | FK → `profiles(id)`                                                   |
| `rejection_reason`          | `text`                                 |                                                                       |
| `created_at` / `updated_at` | `timestamptz`                          | Auto-updated by trigger                                               |

Row created automatically by `handle_new_user` trigger on `auth.users` insert. Role comes from `raw_user_meta_data->>'role'`; `admin` cannot be self-assigned.

Organizer fields were unified into `profiles` (migration `20261111000000_unify_organizer_into_profiles.sql`). Incomplete organizer = missing required `org_name` / `org_type` / `venue_name`. Public-safe approved org fields are exposed via the `organizer_directory` view (no phone).

### `organizer_profiles` (DEPRECATED)

Kept empty after the unify migration. Do **not** write new rows. All app code reads/writes organizer fields on `profiles`. Table is retained (not dropped) only to avoid risky schema churn; insert/update RLS policies were removed.

### `sponsor_profiles`

| Column                      | Type                                    | Notes                                    |
| --------------------------- | --------------------------------------- | ---------------------------------------- |
| `user_id`                   | `uuid` PK                               | FK → `profiles(id)` ON DELETE CASCADE    |
| `company_name`              | `text` NOT NULL                         |                                          |
| `industry`                  | `text`                                  |                                          |
| `budget_min_paise`          | `bigint`                                | CHECK >= 0                               |
| `budget_max_paise`          | `bigint`                                | CHECK >= budget_min_paise                |
| `target_city_ids`           | `int[]` NOT NULL DEFAULT `{}`           |                                          |
| `plan`                      | `sponsor_plan` NOT NULL DEFAULT `basic` | Guard trigger; only service role changes |
| `subscription_expires_at`   | `timestamptz`                           |                                          |
| `created_at` / `updated_at` | `timestamptz`                           |                                          |

### `events`

| Column                      | Type                                         | Notes                                                |
| --------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `id`                        | `uuid` PK DEFAULT gen_random_uuid()          |                                                      |
| `organizer_id`              | `uuid` NOT NULL                              | FK → `profiles(id)` ON DELETE CASCADE                |
| `title`                     | `text` NOT NULL                              |                                                      |
| `description`               | `text`                                       |                                                      |
| `event_type_id`             | `int` NOT NULL                               | FK → `event_types(id)`                               |
| `city_id`                   | `int` NOT NULL                               | FK → `cities(id)`                                    |
| `venue`                     | `text`                                       |                                                      |
| `season`                    | `text`                                       | Free tag, e.g. `navratri-2027`                       |
| `start_date`                | `date` NOT NULL                              |                                                      |
| `end_date`                  | `date` NOT NULL                              | CHECK end_date >= start_date                         |
| `expected_audience`         | `int`                                        | CHECK >= 0                                           |
| `audience_notes`            | `text`                                       |                                                      |
| `visibility`                | `event_visibility` NOT NULL DEFAULT `public` |                                                      |
| `ticketing`                 | `ticketing_mode` NOT NULL DEFAULT `none`     | Reserved for Stage 2                                 |
| `status`                    | `event_status` NOT NULL DEFAULT `draft`      | Guard trigger enforces allowed transitions           |
| `rejection_reason`          | `text`                                       |                                                      |
| `authority_letter_path`     | `text`                                       | Optional PDF in private `event-documents` bucket (FR-EVT-09) |
| `created_at` / `updated_at` | `timestamptz`                                |                                                      |

CHECK: `ticketing = 'none' OR visibility = 'public'` (ticketed events must be public in Stage 2).

### `sponsorship_packages`

| Column         | Type                         | Notes                               |
| -------------- | ---------------------------- | ----------------------------------- |
| `id`           | `uuid` PK                    |                                     |
| `event_id`     | `uuid` NOT NULL              | FK → `events(id)` ON DELETE CASCADE |
| `name`         | `text` NOT NULL              |                                     |
| `price_paise`  | `bigint` NOT NULL CHECK >= 0 | Stored in paise; display in rupees  |
| `deliverables` | `text`                       |                                     |
| `slots_total`  | `int`                        | CHECK > 0                           |
| `created_at`   | `timestamptz`                |                                     |

Organizer writes allowed only when parent event status is `draft` or `rejected` (BR-15). Published package edits go through `event_change_requests.proposed_packages`.

### `interests`

| Column                      | Type                                     | Notes                                              |
| --------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `id`                        | `uuid` PK                                |                                                    |
| `sponsor_id`                | `uuid` NOT NULL                          | FK → `sponsor_profiles(user_id)` ON DELETE CASCADE |
| `event_id`                  | `uuid` NOT NULL                          | FK → `events(id)` ON DELETE CASCADE                |
| `package_id`                | `uuid`                                   | FK → `sponsorship_packages(id)` ON DELETE SET NULL |
| `message`                   | `text`                                   | Initial message from sponsor                       |
| `status`                    | `interest_status` NOT NULL DEFAULT `new` |                                                    |
| `contact_shared`            | `boolean` NOT NULL DEFAULT false         | Phone numbers visible only when true (BR-06)       |
| `created_at` / `updated_at` | `timestamptz`                            |                                                    |

UNIQUE INDEX on `(sponsor_id, event_id, coalesce(package_id, '00000000-...'::uuid))` — enforces BR-05.

### `messages`

| Column        | Type            | Notes                                  |
| ------------- | --------------- | -------------------------------------- |
| `id`          | `uuid` PK       |                                        |
| `interest_id` | `uuid` NOT NULL | FK → `interests(id)` ON DELETE CASCADE |
| `sender_id`   | `uuid` NOT NULL | FK → `profiles(id)`                    |
| `body`        | `text` NOT NULL | CHECK length BETWEEN 1 AND 2000        |
| `created_at`  | `timestamptz`   |                                        |

### `platform_fees`

| Column                      | Type                                    | Notes                                                                 |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `id`                        | `uuid` PK                               |                                                                       |
| `user_id`                   | `uuid` NOT NULL                         | FK → `profiles(id)`                                                   |
| `event_id`                  | `uuid`                                  | FK → `events(id)` ON DELETE SET NULL                                  |
| `fee_type`                  | `fee_type` NOT NULL                     |                                                                       |
| `amount_paise`              | `bigint` NOT NULL CHECK >= 0            | Total charged (listing: GST-inclusive; subscription: base + GST)     |
| `base_paise`                | `bigint`                                | Taxable value (BR-11 / FR-FEE-05)                                     |
| `gst_paise`                 | `bigint`                                | GST portion                                                           |
| `status`                    | `fee_status` NOT NULL DEFAULT `pending` | Service role / support writes only                                    |
| `gateway_order_id`          | `text`                                  | Unique when set (idempotent orders)                                   |
| `gateway_payment_id`        | `text`                                  | Unique when set (idempotent webhooks)                                 |
| `refund_reason`             | `text`                                  | Payment-error refunds only (BR-07, BR-16)                             |
| `paid_at`                   | `timestamptz`                           | Set by webhook; drives 48-hour review timer (BR-12)                   |
| `review_alert_sent_at`      | `timestamptz`                           | Overdue-review email throttle                                         |
| `created_at` / `updated_at` | `timestamptz`                           |                                                                       |

### `settings`

Singleton fee configuration (id = 1). Readable by authenticated users; writable by `super_admin` only (FR-ADM-10, FR-FEE-06).

| Column                   | Type              | Notes                                              |
| ------------------------ | ----------------- | -------------------------------------------------- |
| `id`                     | `integer` PK      | Always `1`                                         |
| `listing_fee_paise`      | `bigint` NOT NULL | GST-inclusive listing total (default 10000)        |
| `subscription_fee_paise` | `bigint` NOT NULL | Subscription base before GST (default 50000)       |
| `gst_rate_pct`           | `numeric(5,2)`    | Default 18.00                                      |
| `gstin`                  | `text`            | Optional until registered; shown on receipts if set |
| `launch_offer_text`      | `text`            | Configurable first-year sponsor offer copy         |
| `updated_at`             | `timestamptz`     |                                                    |

### `audit_log`

| Column       | Type            | Notes                                    |
| ------------ | --------------- | ---------------------------------------- |
| `id`         | `bigserial` PK  |                                          |
| `actor_id`   | `uuid`          | FK → `profiles(id)`                      |
| `action`     | `text` NOT NULL | e.g. `approve_organizer`, `reject_event` |
| `entity`     | `text` NOT NULL | Table name                               |
| `entity_id`  | `text`          |                                          |
| `details`    | `jsonb`         | Additional context                       |
| `created_at` | `timestamptz`   |                                          |

---

## Relationships

| From                   | To                     | Via                               |
| ---------------------- | ---------------------- | --------------------------------- |
| `profiles`             | `auth.users`           | `profiles.id` (CASCADE delete)    |
| `sponsor_profiles`     | `profiles`             | `user_id` (CASCADE delete)        |
| `events`               | `profiles`             | `organizer_id` (CASCADE delete)   |
| `events`               | `cities`               | `city_id`                         |
| `events`               | `event_types`          | `event_type_id`                   |
| `sponsorship_packages` | `events`               | `event_id` (CASCADE delete)       |
| `interests`            | `sponsor_profiles`     | `sponsor_id` (CASCADE delete)     |
| `interests`            | `events`               | `event_id` (CASCADE delete)       |
| `interests`            | `sponsorship_packages` | `package_id` (SET NULL on delete) |
| `messages`             | `interests`            | `interest_id` (CASCADE delete)    |
| `messages`             | `profiles`             | `sender_id`                       |
| `platform_fees`        | `profiles`             | `user_id`                         |
| `platform_fees`        | `events`               | `event_id` (SET NULL on delete)   |
| `audit_log`            | `profiles`             | `actor_id`                        |
| `profiles`             | `profiles`             | `verified_by` (organizer approval) |

---

## RLS Rules Summary

| Table                   | Rule                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| `cities`, `event_types` | Everyone reads; admin writes                                                    |
| `profiles`              | Own row or admin. Approved organizer org fields for public/sponsor use: `organizer_directory` view (no phone) |
| `organizer_profiles`    | DEPRECATED / empty — select only; do not write                                  |
| `sponsor_profiles`      | Own row, admin, or organizer whose event they showed interest in                |
| `events`                | Published public: everyone. Published private: sponsors only. Own/admin: always |
| `sponsorship_packages`  | Follows parent event visibility; organizer or admin writes                      |
| `interests`             | Sponsor (own), event's organizer, or admin                                      |
| `messages`              | Parties in the interest thread only                                             |
| `platform_fees`         | Own row for reads; writes service role or admin only                            |
| `audit_log`             | Admin only                                                                      |

---

## Trigger Descriptions

| Trigger                        | Table                                                                            | Action                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `set_updated_at`               | profiles, organizer_profiles, sponsor_profiles, events, interests, platform_fees | BEFORE UPDATE — sets `updated_at = now()`                                    |
| `on_auth_user_created`         | `auth.users`                                                                     | AFTER INSERT — creates a `profiles` row; role from metadata, `admin` blocked |
| `guard_profile_role`           | `profiles`                                                                       | BEFORE UPDATE — non-admin cannot change `role`                               |
| `guard_organizer_verification` | `profiles`                                                                       | BEFORE UPDATE — non-admin cannot change verification fields                  |
| `guard_sponsor_plan`           | `sponsor_profiles`                                                               | BEFORE UPDATE — non-admin cannot change `plan` or `subscription_expires_at`  |
| `guard_event_status`           | `events`                                                                         | BEFORE UPDATE — enforces allowed status transitions (BR-03)                  |

Helper functions: `set_updated_at()`, `my_role()` (security definer), `is_admin()` (security definer), `handle_new_user()` (security definer).

---

## Seed Data Notes

Applied in the same migration file. Safe to run on a fresh database.

**Cities:** Ahmedabad, Surat, Vadodara, Rajkot (Gujarat)
**Event types:** navratri-garba, diwali-fair, uttarayan, ganesh-utsav, wedding-expo, college-fest, cultural, corporate

To add a new city or event type: `INSERT INTO cities` / `INSERT INTO event_types` — no code change needed (BR-09).

---

## Applied / planned schema notes

### Applied — unify organizer into `profiles` (2026-11-11)

Migration `20261111000000_unify_organizer_into_profiles.sql`:

- Organizer columns live on `profiles` (single table, single `/profile` form).
- `events.organizer_id` references `profiles(id)`.
- `guard_organizer_verification` runs on `profiles`.
- `organizer_directory` view exposes approved organizer org fields without phone (FR-ORG-03 / BR-06).
- `organizer_profiles` left empty and deprecated (not dropped).

### Earlier decisions migration (`20261110000000_stage1_decisions.sql`)

See "Required Schema Changes" in `docs/srs-stage1.md` for the 10 Nov 2026 items (super_admin, settings, fees, change requests, authority letter, etc.). Those are covered by that migration file; keep this document aligned when further schema lands.

### Applied — FR-EVT storage + package RLS (`20261112000000_fr_evt_storage_and_package_rls.sql`)

- Private Storage bucket `event-documents` (PDF only, 5 MB). Path: `{organizer_id}/{event_id}/…`. Organizer + admin read; no public access.
- `sponsorship_packages` write policy locked so organizers cannot mutate packages on `published` (or other non-draft/rejected) events; admins still can (change-request approve).

### `event_change_requests` (from decisions migration)

| Column | Notes |
|--------|--------|
| `event_id` | FK → events |
| `proposed_fields` | jsonb event field snapshot |
| `proposed_packages` | jsonb package list (null = no package change) |
| `new_authority_letter_path` | optional new PDF path |
| `status` | `pending` / `approved` / `rejected` |
| Unique partial index | one pending row per `event_id` |
