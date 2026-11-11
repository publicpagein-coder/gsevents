# SRS Stage 1 — Functional Requirements

Source: `docs/Event Sponsorship Marketplace Software Requirements Specification (Stage 1).docx` in the parent `Event Platform` folder. Requirement IDs, wording and priorities follow that document. The **Notes** column adds how the Stage 1 schema (`supabase/migrations/`) supports each requirement, or flags a gap.

Stage 1 is the skeleton without deal payments: no instalments, ticket sales, reviews or premium sponsor plan (see Out of Scope). The platform's own fees (listing fee and sponsor subscription) are collected online through Razorpay.

Priority: **M** = must have for Stage 1, **S** = should have, **C** = could have.

## Decisions (10 Nov 2026)

These resolve open items in the SRS document. Where they change a requirement or rule, the row below is marked **(updated)**; requirements and rules added here are marked **(new)**.

1. **Online fee payment is in Stage 1.** The listing fee and sponsor subscription are paid online. Deal payments stay in Stage 3.
2. **Payment gateway: Razorpay, in test mode.** Orders API with Standard Checkout, using Razorpay test mode keys for now; no real money moves until live mode is switched on. Razorpay Route covers split settlement in Stage 3, so no gateway change is needed later.
3. **The organizer pays first, then the admin reviews.** The organizer submits an event for review by paying the listing fee. After payment, an admin reviews the event and approves (publishes) or rejects it. Sponsors can show interest in and chat about an event only after it is published.
4. **Review within 48 hours.** Admins review a paid event within 48 hours of payment (BR-12).
5. **Payment deadline: 7 days before the event.** The listing fee must be paid no later than 7 days before the event's start date. After that, the event cannot be paid for and so cannot enter review (BR-10). With the 48-hour review target, a paid event is published at least 5 days before it starts.
6. **Rejection: fix and resubmit, no refund.** A rejected organizer fixes the event and resubmits it without paying again. Stage 1 fees are never refunded, including for rejected or cancelled events (BR-07).
7. **Who pays what, and GST.** Organizers pay ₹100 (10,000 paise) per event, **GST included**, and have no subscription. Only sponsors pay a yearly subscription: ₹500 (50,000 paise) **plus GST** (₹590 at 18%) (BR-11).
8. **Admin roles: one super admin and several admins.** Admins verify organizers and review events. The single super admin can do everything an admin can, plus create and remove admin accounts and change fee settings (BR-13).
9. **No cutoff for resubmission.** Once an event has been paid and reviewed, the 7-day payment deadline no longer limits it. A rejected event can be fixed and resubmitted, and an admin can approve it, at any time before the event starts (BR-14).
10. **Edits to a published event are reviewed.** When an organizer edits a published event, the changes go to admin review. The published version stays live, unchanged, until an admin approves the changes; if the admin rejects them, the published version stays as it is. An event can have only one edit request under review at a time (BR-15).
11. **Government authority letter (optional, per event).** Each event has an optional upload for a supporting document: a letter from a government authority, such as police or municipal permission for the event. PDF only, up to 5 MB. It helps the admin verify the event, and the admin queue flags events without one. Only the organizer and admins can see it (FR-EVT-09, FR-ADM-13).
12. **Overdue reviews email the super admin.** If a submission, resubmission or change request is not reviewed within 48 hours, an email alert goes to the super admin, repeated once a day until the item is reviewed (FR-ADM-14).
13. **The platform runs without the super admin.** The super admin only manages admin accounts, the support permission and fee settings. Reviews, verification and payment errors are handled by admins and support admins, so day-to-day and emergency work never waits for the super admin. No handover process is needed in Stage 1; if the super admin account is lost, the platform team restores it directly in the database.
14. **Support admins handle payment errors.** The super admin can give any admin a "support" permission. A support admin can still review events, and also handles payment errors such as a duplicate charge: refunding in the Razorpay dashboard and marking the fee refunded in the app with a reason. Refunds happen only for payment errors (BR-07, BR-16).
15. **GST details are not available yet.** The platform's GSTIN and GST rate will be added later through fee settings. Until then, receipts show the amount paid without a GSTIN, and full GST invoices (FR-FEE-05) wait for the GST details.
16. **Email through Resend.** Supabase's built-in email sends only its own sign-in emails, so admin alerts are sent through Resend (free tier: 3,000 emails a month, 100 a day). Supabase runs the hourly check with `pg_cron`, which calls a Supabase Edge Function that sends the email through the Resend API. The Resend API key is stored as an Edge Function secret, never in the browser.

Event status transitions:

- `draft` → `pending_review`: the organizer pays the listing fee; the Razorpay webhook (service role) moves the event when the payment is confirmed. Payment is accepted only up to 7 days before the start date.
- `pending_review` → `published` or `rejected`: admin, within 48 hours of payment.
- `rejected` → `pending_review`: the organizer resubmits after fixing the event, without paying again, at any time before the event starts.
- `published` stays `published` while an edit is under review; the admin approves or rejects the change request, not the event (BR-15).
- `published` → `completed`: admin.
- `draft`, `pending_review`, `published` → `cancelled`: organizer or admin. No refund.

## User Classes

| User          | Main goal in Stage 1                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Organizer     | List events and packages, receive sponsor interest, talk to sponsors                                                                                   |
| Sponsor       | Find suitable events, show interest, talk to organizers                                                                                                |
| General user  | Browse public events without needing an account                                                                                                        |
| Admin         | Keep the platform trustworthy by verifying organizers and approving listings                                                                           |
| Support admin | **(new)** An admin given the support permission by the super admin. Everything an admin does, plus handling payment errors                             |
| Super admin   | **(new)** One account. Everything an admin does, plus managing admin accounts, the support permission and fee settings. Receives overdue review alerts |

Operating environment: mobile-first responsive web app for current mobile browsers and desktop. Launch city is Ahmedabad, with Gujarat's other major cities available as data. Interface languages: English, Hindi and Gujarati.

## FR-AUTH: Accounts and Sign-in (3.1)

| ID         | Requirement                                                                                                                                                                  | Priority | Notes                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| FR-AUTH-01 | A user signs up and logs in with a phone number and OTP                                                                                                                      | M        | Supabase Auth phone OTP. The signup trigger creates the `profiles` row; the client never inserts it. |
| FR-AUTH-02 | At signup the user chooses organizer or sponsor. A visitor browsing public events needs no account                                                                           | M        | `general` exists in `user_role` for Stage 2 but is not offered at signup.                            |
| FR-AUTH-03 | **(updated)** A user can never choose admin or super admin at signup. The super admin account is created by the platform team; admin accounts are created by the super admin | M        | Guard trigger blocks self-changes to `role`.                                                         |
| FR-AUTH-04 | A user can view and edit their name, phone, city and preferred language                                                                                                      | M        | `profiles.preferred_language` (`en`/`hi`/`gu`); changing it switches the interface language.         |
| FR-AUTH-05 | OTP requests are rate limited and a user can log out from all devices                                                                                                        | S        | Exact thresholds are an open item.                                                                   |

## FR-ORG: Organizer Profile and Verification (3.2)

| ID        | Requirement                                                                                                                                                          | Priority | Notes                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| FR-ORG-01 | An organizer completes a profile: organization name, type (society, club, company, other), venue, social media link and a proof note such as a past event photo link | M        | Organizer fields live on `profiles` (unified with personal profile). Single form at `/[locale]/profile`.                  |
| FR-ORG-02 | A new organizer starts as pending. The organizer cannot change their own verification status                                                                         | M        | Guard trigger on `profiles` also protects `verified_at`, `verified_by`, `rejection_reason`. Incomplete = missing required org fields on `profiles`. |
| FR-ORG-03 | An admin can approve or reject an organizer, with a reason for rejection                                                                                             | M        | Admin queue reads `profiles` where `role = organizer` and `verification_status = pending`. Approved org fields (no phone) via `organizer_directory` view. |
| FR-ORG-04 | Approved organizers show a Verified badge on their listings                                                                                                          | M        | Derived from `profiles.verification_status = 'approved'`. The Business Model places the verified badge in Stage 2 — see Open Items. |
| FR-ORG-05 | A rejected organizer sees the reason and can update the profile and resubmit                                                                                         | S        | Resubmit on the unified `/profile` form.                                                                                   |

## FR-SPN: Sponsor Profile (3.3)

| ID        | Requirement                                                                                                     | Priority | Notes                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| FR-SPN-01 | A sponsor completes a profile: company name, industry, budget range and target cities                           | M        | `sponsor_profiles` (budget in paise, `target_city_ids`) |
| FR-SPN-02 | Every sponsor is on the basic plan. The sponsor cannot change their own plan or subscription dates              | M        | Guard trigger on `plan` and `subscription_expires_at`.  |
| FR-SPN-03 | A sponsor can see their subscription status and expiry date                                                     | M        |                                                         |
| FR-SPN-04 | An organizer can see the profile of a sponsor who showed interest in their event, and no other sponsor profiles | M        | `sponsors_select` RLS policy                            |

## FR-EVT: Event Listing and Packages (3.4)

| ID        | Requirement                                                                                                                                                                                                      | Priority | Notes                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-EVT-01 | An organizer creates an event as a draft with title, description, event type, city, venue, season tag, start and end date, expected audience and audience notes                                                  | M        | Insert is allowed only with `status = 'draft'`. RLS does not require an approved organizer to create a draft.                                                                                                    |
| FR-EVT-02 | An organizer sets event visibility: public (visible to everyone) or private (visible to sponsors only)                                                                                                           | M        |                                                                                                                                                                                                                  |
| FR-EVT-03 | An organizer adds one or more sponsorship packages to an event with name, price, deliverables and optional number of slots                                                                                       | M        | Price stored as `price_paise`.                                                                                                                                                                                   |
| FR-EVT-04 | An organizer can edit a draft or rejected event and delete a draft                                                                                                                                               | M        | Delete allowed only for drafts (RLS). A rejected event can be edited and resubmitted at any time before it starts (BR-14). Edits to a published event follow FR-EVT-10.                                          |
| FR-EVT-05 | **(updated)** An organizer submits a draft for review by paying the listing fee. The event then shows as pending review. A rejected event is resubmitted without paying again                                    | M        | The webhook moves `draft` → `pending_review` on payment. Payment is blocked once the deadline (start date minus 7 days) has passed (BR-10).                                                                      |
| FR-EVT-06 | An organizer can cancel their own event before it takes place                                                                                                                                                    | M        | Allowed from `draft`, `pending_review`, `published`. The listing fee is not refunded (BR-07).                                                                                                                    |
| FR-EVT-07 | The end date cannot be before the start date. Package price cannot be negative                                                                                                                                   | M        | Check constraints                                                                                                                                                                                                |
| FR-EVT-08 | The event form reserves a ticketing setting that is hidden and set to none in Stage 1                                                                                                                            | S        | `events.ticketing` defaults to `none`.                                                                                                                                                                           |
| FR-EVT-09 | **(new)** The event form has an optional upload for a supporting document: a letter from a government authority, such as police or municipal permission for the event. Only the organizer and admins can view it | M        | Optional for the organizer; the upload feature itself is a must. PDF only, up to 5 MB, checked on the server and by the storage bucket. Stored in a private storage bucket. Not shown to sponsors or the public. |
| FR-EVT-10 | **(new)** An organizer can edit a published event; the changes go to admin review, and the published version stays live and unchanged until an admin approves them                                               | M        | Needs a change-request table, and RLS must stop organizers from updating published events directly (see Required Schema Changes). Covers event fields, packages and the authority letter.                        |

## FR-BRW: Browse and Search (3.5)

| ID        | Requirement                                                                                                           | Priority | Notes                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| FR-BRW-01 | Anyone, including a visitor who is not logged in, can browse published public events                                  | M        |                                                     |
| FR-BRW-02 | Sponsors also see published private events                                                                            | M        |                                                     |
| FR-BRW-03 | Filters: city, event type, season, date range, expected audience range, package price range, verified organizers only | M        | `events_browse_idx`; must meet NFR-PERF-02 (< 1 s). |
| FR-BRW-04 | Text search on event title and description                                                                            | S        | No text-search index yet.                           |
| FR-BRW-05 | Sorting by start date, newest and audience size                                                                       | S        |                                                     |
| FR-BRW-06 | The event detail page shows the event, organizer name with Verified badge, and all packages                           | M        |                                                     |
| FR-BRW-07 | An organizer sees all their own events in any status                                                                  | M        |                                                     |

## FR-INT: Sponsor Interest (3.6)

| ID        | Requirement                                                                                                             | Priority | Notes                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-INT-01 | A sponsor can show interest in a published event, optionally for a specific package, with a short message               | M        | `interests.message`. Interests insert RLS already requires `status = 'published'`, so sponsors cannot interact with paid events still in review. |
| FR-INT-02 | A sponsor cannot send duplicate interest for the same event and package                                                 | M        | Unique index on sponsor, event, package.                                                                                                         |
| FR-INT-03 | The organizer sees incoming interests per event and can set a status: new, contacted, in discussion, closed or declined | M        | `interest_status` enum                                                                                                                           |
| FR-INT-04 | A sponsor can see the status of all their interests and can withdraw one                                                | M        | No `withdrawn` status in the schema — see Open Items.                                                                                            |
| FR-INT-05 | The organizer is notified when a new interest arrives                                                                   | S        | Notification channel is an open item.                                                                                                            |

## FR-CHT: Chat and Contact Sharing (3.7)

| ID        | Requirement                                                                                                                           | Priority | Notes                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| FR-CHT-01 | Each interest has one message thread between the sponsor and that event's organizer                                                   | M        | `messages.interest_id`                                                                 |
| FR-CHT-02 | Only those two users and an admin can read or write in the thread                                                                     | M        | Messages RLS follows interests RLS.                                                    |
| FR-CHT-03 | Messages are text, up to 2000 characters                                                                                              | M        | Check constraint on `messages.body`                                                    |
| FR-CHT-04 | Phone numbers stay hidden until the interest is marked as contact shared. Either party can choose to share their number in the thread | M        | Schema has one `contact_shared` flag per interest, not one per party — see Open Items. |
| FR-CHT-05 | A user can report a message or block the other party                                                                                  | S        | No report or block table yet.                                                          |
| FR-CHT-06 | New messages appear without reloading the page                                                                                        | S        | Supabase Realtime                                                                      |

## FR-FEE: Platform Fees (3.8)

| ID        | Requirement                                                                                                                                                                                                      | Priority | Notes                                                                                                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-FEE-01 | **(updated)** An organizer pays a listing fee of ₹100 (GST included) online through Razorpay for each event, to submit it for review, no later than 7 days before its start date. The fee is paid once per event | M        | Organizers have no subscription. See Required Schema Changes for the payment-before-review check, deadline and one-fee-per-event rule.                                                                                                     |
| FR-FEE-02 | **(updated)** A sponsor pays a yearly subscription of ₹500 plus GST online to unlock showing interest and chat. The subscription applies to sponsors only                                                        | M        | On payment, the webhook sets `subscription_expires_at`. Interests and messages RLS must check for an active subscription (see Required Schema Changes).                                                                                    |
| FR-FEE-03 | Every fee has a status: pending, paid, failed or refunded, with the gateway reference                                                                                                                            | M        | `platform_fees.gateway_order_id` (Razorpay order) and `gateway_payment_id` (Razorpay payment). Status changes only in the webhook handler after verifying the Razorpay signature, never from the client.                                   |
| FR-FEE-04 | **(updated)** Stage 1 fees are non-refundable, including when an event is rejected or cancelled. A rejected event can be resubmitted without paying again                                                        | M        | BR-07. The only exception is correcting a payment error, done by a support admin (BR-16).                                                                                                                                                  |
| FR-FEE-05 | A user can see their own fee history and download a receipt or invoice with GST details                                                                                                                          | S        | Organizer receipts split the ₹100 total into taxable value and GST. Sponsor receipts show ₹500 plus GST (BR-11). GST details are not available yet, so receipts show the amount paid without a GSTIN until they are added in fee settings. |
| FR-FEE-06 | The first-year sponsor offer is configurable, not hard-coded                                                                                                                                                     | S        | Changed by the super admin only (FR-ADM-10). Needs a settings table (also NFR-MNT-05).                                                                                                                                                     |

## FR-ADM: Admin Panel (3.9)

| ID        | Requirement                                                                                                                                                                                           | Priority | Notes                                                                                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-ADM-01 | An admin sees a queue of pending organizers and pending event listings                                                                                                                                | M        | Event queue covers new submissions, resubmissions and change requests to published events, ordered by submission time with time left in the 48-hour review target (BR-12). Events without an authority letter are flagged "No letter" (FR-ADM-13). |
| FR-ADM-02 | An admin can approve or reject an organizer or event, with a reason shown to the organizer                                                                                                            | M        | `rejection_reason` on both tables. Approving a paid event publishes it. The admin can open the authority letter if one was uploaded.                                                                                                               |
| FR-ADM-03 | Only an admin can publish an event. Admin can also unpublish or cancel any event                                                                                                                      | M        |                                                                                                                                                                                                                                                    |
| FR-ADM-04 | An admin can view users, events, interests and fees, and can search them                                                                                                                              | M        |                                                                                                                                                                                                                                                    |
| FR-ADM-05 | **(updated)** A support admin can mark a fee refunded, with a reason, only to correct a payment error such as a duplicate charge                                                                      | M        | The refund itself is made in the Razorpay dashboard. `platform_fees.status = 'refunded'` and `refund_reason`, set through server code that checks the support permission. Recorded in `audit_log`.                                                 |
| FR-ADM-06 | Every admin action is recorded in an audit log with who, what and when                                                                                                                                | M        | `audit_log`                                                                                                                                                                                                                                        |
| FR-ADM-07 | An admin can manage cities and event types (add a row, no code change)                                                                                                                                | S        | Admin-only write policies on lookups                                                                                                                                                                                                               |
| FR-ADM-08 | An admin can read a reported chat thread and suspend a user                                                                                                                                           | S        | No suspended state on profiles yet.                                                                                                                                                                                                                |
| FR-ADM-09 | **(new)** The super admin can create and remove admin accounts, and give or remove the support permission                                                                                             | M        | Needs a `super_admin` role (see Required Schema Changes). Recorded in `audit_log`.                                                                                                                                                                 |
| FR-ADM-10 | **(new)** The super admin can change fee settings: listing fee, subscription price, GST rate and the first-year sponsor offer                                                                         | M        | Needs a settings table writable by the super admin only. Recorded in `audit_log`.                                                                                                                                                                  |
| FR-ADM-11 | **(new)** Events not reviewed within 48 hours of payment are highlighted as overdue in the admin queue                                                                                                | S        | BR-12                                                                                                                                                                                                                                              |
| FR-ADM-12 | **(new)** An admin can approve or reject changes to a published event, with a reason shown to the organizer. Approved changes replace the published version; rejected changes are discarded           | M        | BR-15. Recorded in `audit_log`.                                                                                                                                                                                                                    |
| FR-ADM-13 | **(new)** The admin queue flags events that have no government authority letter, so admins can take extra care when verifying them. The letter stays optional and its absence does not block approval | M        | Derived from `events.authority_letter_path is null`; no extra column needed.                                                                                                                                                                       |
| FR-ADM-14 | **(new)** When a submission, resubmission or change request has waited 48 hours without review, the super admin receives an email alert, repeated daily until reviewed                                | M        | A scheduled job (for example hourly) finds overdue items and emails when no alert was sent in the last 24 hours; sent through Resend from a Supabase Edge Function called by `pg_cron`.                                                            |
| FR-ADM-15 | **(new)** A support admin sees a list of payment issues: payments stuck in pending, mismatches flagged by reconciliation, and possible duplicate charges                                              | S        | NFR-PAY-02                                                                                                                                                                                                                                         |

## FR-LOC: Language and Localization (3.10)

| ID        | Requirement                                                                                            | Priority | Notes                                           |
| --------- | ------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------- |
| FR-LOC-01 | The interface is available in English, Hindi and Gujarati and the user can switch language at any time | M        | next-intl message files; no hard-coded strings. |
| FR-LOC-02 | Text typed by users (titles, descriptions, messages) is kept as typed in the language used             | M        |                                                 |
| FR-LOC-03 | Amounts are shown in rupees with Indian number grouping and dates in a local format                    | S        | `formatRupees()` in `src/lib/utils.ts`          |

---

## User Stories

**Organizer**

- As an organizer, I want to create my profile so that sponsors can trust my events.
- As an organizer, I want to list my event with several sponsorship packages so that sponsors can pick what fits their budget.
- As an organizer, I want to see which sponsors are interested and talk to them in one place.
- As an organizer, I want to understand why a listing was rejected so I can fix it.

**Sponsor**

- As a sponsor, I want to filter events by city, type and audience size so that I only see relevant ones.
- As a sponsor, I want to see who the organizer is and whether they are verified so that I avoid fake events.
- As a sponsor, I want to message an organizer without sharing my phone number first.
- As a sponsor, I want to see the status of all my interests.

**General user**

- As a visitor, I want to browse public events without creating an account.

**Admin**

- As an admin, I want a single queue of pending items so I can approve quickly.
- As an admin, I want every action logged so I can resolve disputes later.

**Super admin**

- **(new)** As the super admin, I want to add and remove admins so the review team can grow without developer help.
- **(new)** As the super admin, I want to change fees and the launch offer without a code change.

---

## Business Rules

| ID    | Rule                                                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | A listing reaches the public only after admin approval and payment of the listing fee                                                                                                                                                                                                   |
| BR-02 | Users cannot change their own role, verification status, sponsor plan or subscription dates (guard triggers)                                                                                                                                                                            |
| BR-03 | **(updated)** Event status moves draft → pending review (on payment of the listing fee) → published → completed, with rejected and cancelled as other end states. An organizer pays to submit, resubmits after rejection, and can cancel. Only an admin publishes, rejects or completes |
| BR-04 | Private events are visible to sponsors only. Public events are visible to everyone                                                                                                                                                                                                      |
| BR-05 | A sponsor can express interest in a given event and package only once                                                                                                                                                                                                                   |
| BR-06 | Phone numbers are never shown to the other party until contact sharing is set                                                                                                                                                                                                           |
| BR-07 | **(updated)** Stage 1 fees are non-refundable, including when an event is rejected or cancelled. A rejected event can be resubmitted without paying again. The only refunds are corrections of payment errors, made by a support admin                                                  |
| BR-08 | No deal commission is charged in Stage 1                                                                                                                                                                                                                                                |
| BR-09 | Adding a city, event type or season must need only data entry, not code changes                                                                                                                                                                                                         |
| BR-10 | **(new)** The listing fee must be paid no later than 7 days before the event's start date. After that deadline the event cannot be paid for, and so cannot enter review                                                                                                                 |
| BR-11 | **(new)** Organizers pay ₹100 per event with GST included and have no subscription. Only sponsors have a subscription: ₹500 per year plus GST                                                                                                                                           |
| BR-12 | **(new)** An admin reviews a paid event within 48 hours of payment. The same 48-hour target applies to resubmissions and change requests, counted from when they are submitted. An item still unreviewed after 48 hours triggers an email to the super admin                            |
| BR-13 | **(new)** There is exactly one super admin. Only the super admin creates or removes admins, gives or removes the support permission, and changes fee settings. No other platform work depends on the super admin                                                                        |
| BR-16 | **(new)** Only admins with the support permission handle payment errors and mark fees refunded, and only to correct a payment error                                                                                                                                                     |
| BR-14 | **(new)** The 7-day payment deadline applies only to the first payment. A rejected event can be resubmitted, and approved by an admin, at any time before it starts                                                                                                                     |
| BR-15 | **(new)** Changes to a published event take effect only after admin approval. Until then, the published version stays live and unchanged. An event can have only one edit request under review at a time                                                                                |

---

## Screens

- **Public:** home and search, event list with filters, event detail, login and OTP, language switch.
- **Organizer:** onboarding profile, dashboard (events and statuses, including changes awaiting review), create or edit event (with optional authority letter upload), manage packages, pay listing fee and submit for review, interests inbox, chat thread, fee history.
- **Sponsor:** onboarding profile, subscription, event discovery, interests list with status, chat thread, fee history.
- **Admin:** pending queue (with 48-hour review timer and a "No letter" flag), organizer review, event review (with authority letter viewer), change request review (published version beside the proposed changes), user and fee lists, audit log, cities and event types.
- **Support admin (new):** everything in Admin, plus payment issues and marking fees refunded.
- **Super admin (new):** everything in Admin, plus admin accounts (with the support permission toggle) and fee settings.

## Data Requirements

The data model is defined in `supabase/migrations/20261109000000_stage1_schema.sql` (identical to `stage1_schema.sql` in the parent `docs` folder): profiles, organizer and sponsor profiles, events, sponsorship packages, interests, messages, platform fees, audit log, plus cities and event types. Money is stored in paise. See `docs/database-design.md`.

## External Interfaces

- **OTP and SMS:** an SMS provider with DLT registration, or WhatsApp OTP, for login and notifications.
- **Payment gateway: Razorpay.** Orders API and Standard Checkout for the platform's own fees only, using test mode keys for now. Webhooks (`payment.captured`, `payment.failed`) update `platform_fees` after verifying the `X-Razorpay-Signature` header with the webhook secret. Keys live in environment variables; the key secret and webhook secret are server-only. Split settlement (Razorpay Route) is not needed until Stage 3.
- **Email or SMS notifications:** for new interests, listing approval or rejection, and fee receipts.
- **Transactional email (new): Resend.** Overdue review alerts to the super admin (FR-ADM-14), and later other notifications. Supabase `pg_cron` runs hourly and calls a Supabase Edge Function, which sends through the Resend API with the `RESEND_API_KEY` secret. Sending to any address needs a verified sending domain (DNS records); until then Resend only delivers to the Resend account's own email.
- **File storage:** for event images, proof uploads and government authority letters, with type and size limits. Authority letters go in a private bucket.

---

## Out of Scope (Stage 1)

- Deal payments, escrow and instalment release (Stage 3).
- Ticket sales, QR entry passes and general user accounts (Stage 2).
- Premium sponsor plan, reviews, ratings and deal status tracking (Stage 2).
- Commission of 1 to 5 percent on deals and tickets (later).
- Full PAN and bank verification of organizers (Stage 3).

---

## Open Items

Resolved on 10 Nov 2026 (see Decisions): fee payment in Stage 1 (online, Razorpay test mode), the order of fee and approval (pay first, then review), review time (48 hours), refunds (none), GST (included for organizers, added for sponsors), admin provisioning (super admin creates admins), resubmission cutoff (none once an event has been reviewed; any time before it starts), edits to published events (reviewed by an admin, one open request at a time), authority letter limits (PDF only, up to 5 MB), flagging events without a letter, missed reviews (daily email to the super admin until reviewed), email provider (Resend), super admin continuity (not needed for daily or emergency work) and payment errors (support admins).

From the SRS document:

- **First-year sponsor offer:** launch price, or free for the first sponsors, is not decided.
- **Chat or contact sharing only:** the scope includes simple in-app chat. Contact sharing alone is a cheaper fallback.
- **Notifications:** which channels (SMS, email, WhatsApp) and their cost cap.
- **Reporting and blocking:** confirm whether it is needed in Stage 1.

Raised while comparing the SRS with the schema and other documents:

- **Verified badge stage:** FR-ORG-04 makes the badge Stage 1 (M), but the Business Model lists the verified badge under Stage 2.
- **Withdraw interest (FR-INT-04):** `interest_status` has no `withdrawn` value. Add one in a new migration, or decide that withdrawing deletes the interest.
- **Per-party contact sharing (FR-CHT-04):** one `contact_shared` flag reveals both phone numbers, and either party can set it under the current RLS. Decide whether each party shares only their own number (two flags), and who may set it.
- **Report, block and suspend (FR-CHT-05, FR-ADM-08):** no tables or columns yet.
- **OTP limits:** exact rate-limit thresholds and lockout duration.
- **Storage bucket policies:** for event images, proof documents and authority letters, to be added in a migration when file upload is built.

Raised by the payment and admin decisions:

- **Razorpay live mode:** Stage 1 runs on test mode. Switching to live mode needs business KYC (PAN, bank account, business details), which can take several days, so start it well before launch.
- **Domain (to buy later):** the planned domain is `eventsponsors.com` (not yet purchased; check it is available).
  - **Until then:** the app runs on Vercel's default address (`<project>.vercel.app`), which is also set as the Site URL and redirect URL in Supabase Auth. Resend cannot verify a `vercel.app` address, so alerts are sent from Resend's test sender (`onboarding@resend.dev`), which delivers only to the Resend account owner. Create the Resend account with the super admin's email address so overdue alerts still reach them.
  - **After purchase:** add the domain in Vercel and update the Supabase Auth Site URL and redirect URLs. Verify a sending subdomain such as `mail.eventsponsors.com` in Resend (SPF and DKIM DNS records) and send from an address like `alerts@mail.eventsponsors.com`; a subdomain protects the main domain's email reputation.
- **Subscription renewal:** auto-renew or manual renewal, and what happens to open interests and chats when a subscription expires.
- **GST details (not available yet):** the platform's GSTIN and the GST rate (18% is typical for online services). At 18%, the organizer's ₹100 is ₹84.75 plus ₹15.25 GST, and the sponsor pays ₹500 plus ₹90 GST, ₹590 in total. Before switching Razorpay to live mode, confirm with an accountant that the platform is GST-registered: a business that is not registered cannot charge GST, so the sponsor's "plus GST" amount cannot be collected until it is. Test mode is unaffected.

## Required Schema Changes

These follow from the decisions above. They go in a new migration (the applied Stage 1 migration is never edited), and `docs/database-design.md` must be updated with them.

- **Payment before review:** `guard_event_status` allows `draft` → `pending_review` only when a paid `event_listing` fee exists for the event (the webhook makes this change with the service role). `rejected` → `pending_review` by the organizer is allowed because the fee is already paid. This replaces the migration comment "Add a check here later that the listing fee is paid before submission".
- **One listing fee per event:** a unique partial index on `platform_fees (event_id)` where `fee_type = 'event_listing'` and `status = 'paid'`.
- **Payment deadline (BR-10):** the server creates a Razorpay order for a listing fee only while `current_date <= start_date - 7`. A payment confirmed after the deadline for an order created before it is still accepted, so an organizer who paid in time is never left without a review.
- **Review timer (BR-12):** add `platform_fees.paid_at` (set by the webhook) so the admin queue can show time since payment.
- **GST amounts (BR-11):** store `base_paise`, `gst_paise` and `amount_paise` (total charged) on `platform_fees`. For a listing fee the total is 10,000 and the base is derived; for a subscription the base is 50,000 and GST is added.
- **Super admin (BR-13):** add `super_admin` to `user_role`, with a unique partial index so at most one profile has it. `is_admin()` returns true for both roles; a new `is_super_admin()` guards admin-account changes and settings. `guard_profile_role` lets only the super admin give or remove the `admin` role.
- **Settings table (FR-ADM-10, FR-FEE-06):** fee amounts, GST rate, GSTIN (empty until available) and the launch offer, readable by the server and writable by the super admin only.
- **Support permission (BR-16):** add `profiles.is_support` (boolean, default false). Only the super admin can change it (extend `guard_profile_role`). Marking a fee refunded is done by server code that checks `is_support`.
- **Overdue review alerts (FR-ADM-14):** a `review_alert_sent_at` timestamp on each reviewable item (event submission and change request) so the scheduled job emails the super admin about an overdue item at most once every 24 hours until it is reviewed.
- **Subscription gate:** interests and messages insert policies require the sponsor's `subscription_expires_at > now()`.
- **Idempotent payments:** unique indexes on `platform_fees.gateway_order_id` and `platform_fees.gateway_payment_id`, so a repeated webhook can never record a payment twice.
- **Resubmission without deadline (BR-14):** `rejected` → `pending_review` and `pending_review` → `published` are allowed until `start_date`, with no 7-day check. Only the first payment is limited by the 7-day deadline.
- **Change requests for published events (BR-15):** a new `event_change_requests` table (event, proposed event fields and packages as JSON, optional new authority letter path, status `pending`/`approved`/`rejected`, rejection reason, submitted and reviewed timestamps, reviewer). Readable and insertable by the event's organizer, reviewable by admins. On approval, server code applies the changes to `events` and `sponsorship_packages`. RLS on `events` and `sponsorship_packages` must stop organizers from updating published events directly. A unique partial index on `event_change_requests (event_id)` where `status = 'pending'` allows only one open request per event.
- **Authority letter (FR-EVT-09):** add `events.authority_letter_path` (nullable text). A private storage bucket (for example `event-documents`) with policies: the event's organizer uploads and reads, admins read, nobody else. The bucket allows only `application/pdf` with a 5 MB file size limit.
