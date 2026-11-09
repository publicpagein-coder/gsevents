# SRS Stage 1 — Functional Requirements

## FR-AUTH: Authentication and User Profile (3.1)

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | User can sign up with a phone number and OTP. At signup the user chooses the role `organizer` or `sponsor`. The database trigger creates the profile row; the client must not insert it. Admin can never be chosen at signup. |
| FR-AUTH-02 | User can sign in with phone number and OTP. |
| FR-AUTH-03 | OTP requests and verification attempts are rate-limited. |
| FR-AUTH-04 | Signed-in user can view and edit their profile: full name, phone, city, preferred language (en / hi / gu). Changing preferred language switches the interface language immediately. |
| FR-AUTH-05 | User can sign out. User can sign out from all devices. |

## FR-ORG: Organizer Profile (3.2)

| ID | Requirement |
|----|-------------|
| FR-ORG-01 | Organizer fills in profile: organisation name, type (society / club / company / other), venue name, social link, proof note (link or note to a past event photo). |
| FR-ORG-02 | Organizer profile starts with `verification_status = pending`. |
| FR-ORG-03 | Approved organizer profiles are publicly visible to sponsors (so they can see who is behind a listing). |
| FR-ORG-04 | Organizer cannot change their own verification status, `verified_at`, `verified_by`, or `rejection_reason`. (Guard trigger enforces this.) |

## FR-EVT: Events and Packages (3.4)

| ID | Requirement |
|----|-------------|
| FR-EVT-01 | Approved organizer can create an event (status starts as `draft`): title, description, event type, city, venue, season tag, start/end dates, expected audience, audience notes, visibility (public / private). |
| FR-EVT-02 | Organizer can add sponsorship packages to their event: name, price (paise), deliverables, slots total. |
| FR-EVT-03 | Organizer submits a draft or rejected event for review (status → `pending_review`). |
| FR-EVT-04 | Organizer can cancel a draft, pending, or published event (status → `cancelled`). |
| FR-EVT-05 | Event goes live only after admin approval AND listing fee paid (BR-01). |
| FR-EVT-06 | Private events are visible to sponsors only (BR-04). |
| FR-EVT-07 | A `ticketing` column is reserved for Stage 2; in Stage 1 it defaults to `none`. |

## FR-BRW: Browse and Filters (3.5)

| ID | Requirement |
|----|-------------|
| FR-BRW-01 | Anyone (including unauthenticated visitors) can browse published public events. |
| FR-BRW-02 | Sponsors can also see published private events. |
| FR-BRW-03 | Browse supports filters: city, event type, season, date range, expected audience range, price range, verified organiser only. |
| FR-BRW-04 | Search/filter response < 1 s (NFR-PERF-02). |

## FR-INT: Sponsor Interest (3.3 and 3.6)

| ID | Requirement |
|----|-------------|
| FR-INT-01 | A sponsor can express interest in a published event, optionally choosing a package. |
| FR-INT-02 | A sponsor can express interest in a given event+package only once (BR-05; enforced by unique index). |
| FR-INT-03 | Interest has a status: new → contacted → in_discussion → closed / declined. |
| FR-INT-04 | Phone numbers are not shared until `interests.contact_shared = true` (BR-06). |

## FR-CHT: Chat and Contact Sharing (3.7)

| ID | Requirement |
|----|-------------|
| FR-CHT-01 | The sponsor and the event's organiser can exchange messages within an interest thread. |
| FR-CHT-02 | Messages are limited to 2000 characters. |
| FR-CHT-03 | The organiser can mark `contact_shared = true` on an interest, after which both parties' phone numbers become visible to each other. |

## FR-FEE: Platform Fees (3.8)

| ID | Requirement |
|----|-------------|
| FR-FEE-01 | Organiser pays a ₹100 listing fee before an event can be submitted for review. |
| FR-FEE-02 | Sponsor can subscribe at ₹500/yr (basic plan). |
| FR-FEE-03 | Fee status is managed by server code / webhooks only (service role). Client never updates fee status. |
| FR-FEE-04 | Listing fee is non-refundable except when the platform rejects the listing (BR-07). |

## FR-ADM: Admin Panel (3.9)

| ID | Requirement |
|----|-------------|
| FR-ADM-01 | Admin sees a queue of pending organiser verifications: approve or reject with a reason. |
| FR-ADM-02 | Admin sees a queue of events in `pending_review`: approve (publish) or reject with a reason. |
| FR-ADM-03 | Admin can complete a published event. |
| FR-ADM-04 | All admin actions are recorded in `audit_log`. |
| FR-ADM-05 | Admin accounts are provisioned by the platform team (not via the sign-up flow). |

## FR-LOC: Localisation (all modules)

| ID | Requirement |
|----|-------------|
| FR-LOC-01 | All visible interface text is delivered via next-intl in English (en), Hindi (hi), and Gujarati (gu). No hardcoded strings. |
| FR-LOC-02 | User can switch interface language from their profile. The choice is stored in `profiles.preferred_language`. |
| FR-LOC-03 | New cities, event types, and seasons are added as data rows, not code changes (BR-09). |

---

## Business Rules

| ID | Rule |
|----|------|
| BR-01 | An event goes live only after admin approval **and** listing fee paid. |
| BR-02 | Users cannot change their own role, verification status, plan, or subscription dates. (Enforced by guard triggers.) |
| BR-03 | Event status transitions: organiser can move `draft`/`rejected` → `pending_review`, or any non-terminal status → `cancelled`. Publishing, rejecting, and completing are admin/service-role actions only. |
| BR-04 | Private events (`visibility = 'private'`) are visible to sponsors only, not to unauthenticated visitors or general users. |
| BR-05 | A sponsor can express interest in a given event+package combination only once. |
| BR-06 | Phone numbers are not shared until `interests.contact_shared = true`. |
| BR-07 | Stage 1 fees are non-refundable, except the listing fee when the platform rejects the listing. |
| BR-08 | No deal commission in Stage 1. |
| BR-09 | Adding a new city, event type, or season is a data-entry operation (insert a row), not a code change. |

---

## Screen List (Stage 1)

- Sign-in / OTP entry
- Role choice at sign-up (organiser or sponsor)
- Organiser profile form
- Sponsor profile form
- Event listing form + package form
- Browse/search events (public home page)
- Event detail page
- Sponsor interest form
- Interest / chat thread
- Organiser dashboard (my events, interests received)
- Sponsor dashboard (interests sent, messages)
- Admin: pending organisers queue
- Admin: pending events queue
- Admin: audit log
- User profile / settings (name, phone, city, language)

---

## Out of Scope (Stage 1)

- Ticket purchase and QR entry passes
- General user accounts (they can browse without signing in)
- Deal payments and commission
- Premium sponsor plan
- Reviews and ratings
- React Native / Android app
- Razorpay Route / Cashfree split-settlement
- Invoicing, GST, TDS

---

## Open Items

- Payment gateway selection (Razorpay vs. Cashfree).
- Exact OTP rate-limit thresholds and lockout duration.
- Refund flow implementation (manual vs. automated).
- Sponsor subscription auto-renew policy.
- Admin account provisioning process.
- Storage bucket policies for event images and proof documents (to be added in a migration when file upload is built).
