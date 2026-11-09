# Database Design

Schema source: `supabase/migrations/20261109000000_stage1_schema.sql`

## Enums

| Enum | Values |
|------|--------|
| `user_role` | `organizer`, `sponsor`, `general`, `admin` |
| `verification_status` | `pending`, `approved`, `rejected` |
| `organizer_type` | `society`, `club`, `company`, `other` |
| `sponsor_plan` | `basic`, `premium` |
| `event_visibility` | `public`, `private` |
| `ticketing_mode` | `none`, `ticketed` |
| `event_status` | `draft`, `pending_review`, `published`, `rejected`, `cancelled`, `completed` |
| `interest_status` | `new`, `contacted`, `in_discussion`, `closed`, `declined` |
| `fee_type` | `event_listing`, `sponsor_subscription` |
| `fee_status` | `pending`, `paid`, `failed`, `refunded` |

---

## Table Dictionary

### `cities`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial` PK | |
| `name` | `text` NOT NULL | |
| `state` | `text` NOT NULL | |
| `is_active` | `boolean` NOT NULL DEFAULT true | |
| — | UNIQUE(`name`, `state`) | |

Seed data: Ahmedabad, Surat, Vadodara, Rajkot (all in Gujarat).

### `event_types`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial` PK | |
| `slug` | `text` NOT NULL UNIQUE | |
| `name` | `text` NOT NULL | |

Seed data: navratri-garba, diwali-fair, uttarayan, ganesh-utsav, wedding-expo, college-fest, cultural, corporate.

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | References `auth.users(id)` ON DELETE CASCADE |
| `role` | `user_role` NOT NULL DEFAULT `general` | Guard trigger prevents self-change |
| `full_name` | `text` | |
| `phone` | `text` | |
| `city_id` | `int` | FK → `cities(id)` |
| `preferred_language` | `text` NOT NULL DEFAULT `en` | CHECK IN ('en','hi','gu') |
| `created_at` | `timestamptz` NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT now() | Auto-updated by trigger |

Row created automatically by `handle_new_user` trigger on `auth.users` insert. Role comes from `raw_user_meta_data->>'role'`; `admin` cannot be self-assigned.

### `organizer_profiles`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` PK | FK → `profiles(id)` ON DELETE CASCADE |
| `org_name` | `text` NOT NULL | |
| `org_type` | `organizer_type` NOT NULL DEFAULT `society` | |
| `venue_name` | `text` | |
| `social_link` | `text` | |
| `proof_note` | `text` | Link or note for a past event photo |
| `verification_status` | `verification_status` NOT NULL DEFAULT `pending` | Guard trigger; only admin can change |
| `verified_at` | `timestamptz` | Set by admin on approval |
| `verified_by` | `uuid` | FK → `profiles(id)` |
| `rejection_reason` | `text` | |
| `created_at` / `updated_at` | `timestamptz` | |

### `sponsor_profiles`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` PK | FK → `profiles(id)` ON DELETE CASCADE |
| `company_name` | `text` NOT NULL | |
| `industry` | `text` | |
| `budget_min_paise` | `bigint` | CHECK >= 0 |
| `budget_max_paise` | `bigint` | CHECK >= budget_min_paise |
| `target_city_ids` | `int[]` NOT NULL DEFAULT `{}` | |
| `plan` | `sponsor_plan` NOT NULL DEFAULT `basic` | Guard trigger; only service role changes |
| `subscription_expires_at` | `timestamptz` | |
| `created_at` / `updated_at` | `timestamptz` | |

### `events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK DEFAULT gen_random_uuid() | |
| `organizer_id` | `uuid` NOT NULL | FK → `organizer_profiles(user_id)` ON DELETE CASCADE |
| `title` | `text` NOT NULL | |
| `description` | `text` | |
| `event_type_id` | `int` NOT NULL | FK → `event_types(id)` |
| `city_id` | `int` NOT NULL | FK → `cities(id)` |
| `venue` | `text` | |
| `season` | `text` | Free tag, e.g. `navratri-2027` |
| `start_date` | `date` NOT NULL | |
| `end_date` | `date` NOT NULL | CHECK end_date >= start_date |
| `expected_audience` | `int` | CHECK >= 0 |
| `audience_notes` | `text` | |
| `visibility` | `event_visibility` NOT NULL DEFAULT `public` | |
| `ticketing` | `ticketing_mode` NOT NULL DEFAULT `none` | Reserved for Stage 2 |
| `status` | `event_status` NOT NULL DEFAULT `draft` | Guard trigger enforces allowed transitions |
| `rejection_reason` | `text` | |
| `created_at` / `updated_at` | `timestamptz` | |

CHECK: `ticketing = 'none' OR visibility = 'public'` (ticketed events must be public in Stage 2).

### `sponsorship_packages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `event_id` | `uuid` NOT NULL | FK → `events(id)` ON DELETE CASCADE |
| `name` | `text` NOT NULL | |
| `price_paise` | `bigint` NOT NULL CHECK >= 0 | Stored in paise; display in rupees |
| `deliverables` | `text` | |
| `slots_total` | `int` | CHECK > 0 |
| `created_at` | `timestamptz` | |

### `interests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `sponsor_id` | `uuid` NOT NULL | FK → `sponsor_profiles(user_id)` ON DELETE CASCADE |
| `event_id` | `uuid` NOT NULL | FK → `events(id)` ON DELETE CASCADE |
| `package_id` | `uuid` | FK → `sponsorship_packages(id)` ON DELETE SET NULL |
| `message` | `text` | Initial message from sponsor |
| `status` | `interest_status` NOT NULL DEFAULT `new` | |
| `contact_shared` | `boolean` NOT NULL DEFAULT false | Phone numbers visible only when true (BR-06) |
| `created_at` / `updated_at` | `timestamptz` | |

UNIQUE INDEX on `(sponsor_id, event_id, coalesce(package_id, '00000000-...'::uuid))` — enforces BR-05.

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `interest_id` | `uuid` NOT NULL | FK → `interests(id)` ON DELETE CASCADE |
| `sender_id` | `uuid` NOT NULL | FK → `profiles(id)` |
| `body` | `text` NOT NULL | CHECK length BETWEEN 1 AND 2000 |
| `created_at` | `timestamptz` | |

### `platform_fees`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → `profiles(id)` |
| `event_id` | `uuid` | FK → `events(id)` ON DELETE SET NULL |
| `fee_type` | `fee_type` NOT NULL | |
| `amount_paise` | `bigint` NOT NULL CHECK >= 0 | |
| `status` | `fee_status` NOT NULL DEFAULT `pending` | Service role only writes |
| `gateway_order_id` | `text` | |
| `gateway_payment_id` | `text` | |
| `refund_reason` | `text` | e.g. listing rejected by platform |
| `created_at` / `updated_at` | `timestamptz` | |

### `audit_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial` PK | |
| `actor_id` | `uuid` | FK → `profiles(id)` |
| `action` | `text` NOT NULL | e.g. `approve_organizer`, `reject_event` |
| `entity` | `text` NOT NULL | Table name |
| `entity_id` | `text` | |
| `details` | `jsonb` | Additional context |
| `created_at` | `timestamptz` | |

---

## Relationships

| From | To | Via |
|------|----|-----|
| `profiles` | `auth.users` | `profiles.id` (CASCADE delete) |
| `organizer_profiles` | `profiles` | `user_id` (CASCADE delete) |
| `sponsor_profiles` | `profiles` | `user_id` (CASCADE delete) |
| `events` | `organizer_profiles` | `organizer_id` (CASCADE delete) |
| `events` | `cities` | `city_id` |
| `events` | `event_types` | `event_type_id` |
| `sponsorship_packages` | `events` | `event_id` (CASCADE delete) |
| `interests` | `sponsor_profiles` | `sponsor_id` (CASCADE delete) |
| `interests` | `events` | `event_id` (CASCADE delete) |
| `interests` | `sponsorship_packages` | `package_id` (SET NULL on delete) |
| `messages` | `interests` | `interest_id` (CASCADE delete) |
| `messages` | `profiles` | `sender_id` |
| `platform_fees` | `profiles` | `user_id` |
| `platform_fees` | `events` | `event_id` (SET NULL on delete) |
| `audit_log` | `profiles` | `actor_id` |
| `organizer_profiles` | `profiles` | `verified_by` |

---

## RLS Rules Summary

| Table | Rule |
|-------|------|
| `cities`, `event_types` | Everyone reads; admin writes |
| `profiles` | Own row or admin |
| `organizer_profiles` | Own row, admin, or approved (public read for sponsors) |
| `sponsor_profiles` | Own row, admin, or organizer whose event they showed interest in |
| `events` | Published public: everyone. Published private: sponsors only. Own/admin: always |
| `sponsorship_packages` | Follows parent event visibility; organizer or admin writes |
| `interests` | Sponsor (own), event's organizer, or admin |
| `messages` | Parties in the interest thread only |
| `platform_fees` | Own row for reads; writes service role or admin only |
| `audit_log` | Admin only |

---

## Trigger Descriptions

| Trigger | Table | Action |
|---------|-------|--------|
| `set_updated_at` | profiles, organizer_profiles, sponsor_profiles, events, interests, platform_fees | BEFORE UPDATE — sets `updated_at = now()` |
| `on_auth_user_created` | `auth.users` | AFTER INSERT — creates a `profiles` row; role from metadata, `admin` blocked |
| `guard_profile_role` | `profiles` | BEFORE UPDATE — non-admin cannot change `role` |
| `guard_organizer_verification` | `organizer_profiles` | BEFORE UPDATE — non-admin cannot change verification fields |
| `guard_sponsor_plan` | `sponsor_profiles` | BEFORE UPDATE — non-admin cannot change `plan` or `subscription_expires_at` |
| `guard_event_status` | `events` | BEFORE UPDATE — enforces allowed status transitions (BR-03) |

Helper functions: `set_updated_at()`, `my_role()` (security definer), `is_admin()` (security definer), `handle_new_user()` (security definer).

---

## Seed Data Notes

Applied in the same migration file. Safe to run on a fresh database.

**Cities:** Ahmedabad, Surat, Vadodara, Rajkot (Gujarat)
**Event types:** navratri-garba, diwali-fair, uttarayan, ganesh-utsav, wedding-expo, college-fest, cultural, corporate

To add a new city or event type: `INSERT INTO cities` / `INSERT INTO event_types` — no code change needed (BR-09).
