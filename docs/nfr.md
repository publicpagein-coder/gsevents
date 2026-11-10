# Non-Functional Requirements (NFR)

Source: `docs/Event Sponsorship Marketplace Non-Functional Requirements (NFR).pdf` in the parent `Event Platform` folder. That PDF is the master copy; the `.docx` beside it is an older draft with a different ID scheme and should not be used. IDs and targets below follow the PDF. All numeric targets are proposed starting points until the Navratri 2027 scale is agreed.

This file lists every requirement that applies to **Stage 1**. Later-stage requirements are listed by ID at the end for reference only. The **Stack notes** column says how the chosen stack (Next.js on Vercel, Supabase) meets the requirement, or what is still needed.

## Assumptions

- First launch is one city (Ahmedabad) and one season (Navratri 2027). Sponsorship sales run roughly July to September; events run in October.
- Load is low most of the year and spikes sharply during the event window.
- Most users are on mobile phones, often on average mobile networks.
- Target scale (organizers, sponsors, events) is not decided yet; targets use placeholders.
- The platform must stay cheap to run, because the early goal is only to cover running costs.

## Performance

| ID          | Requirement                                                                   | Target                        | Stack notes                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| NFR-PERF-01 | Page load time for browse and event detail pages on a mid-range phone over 4G | Under 3 s                     | Server-rendered pages, AVIF/WebP images, minimal client JavaScript, purged Tailwind CSS                                       |
| NFR-PERF-02 | Search and filter response time                                               | Under 1 s for typical queries | `events_browse_idx` composite index; paginated lists                                                                          |
| NFR-PERF-03 | API response time for normal actions (95th percentile)                        | Under 500 ms                  | Put the Supabase project in Mumbai (`ap-south-1`) and Vercel functions in `bom1` so they run close to users and to each other |

## Scalability

| ID          | Requirement                                                                                                                                                                             | Stack notes                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| NFR-SCAL-01 | Handle the peak load of the Navratri window without manual intervention. Peak concurrent users to be confirmed (placeholder: 10x the average daily load)                                | Vercel scales automatically; size the Supabase compute tier before July                        |
| NFR-SCAL-02 | Add a new city, event type, language or season by adding data and configuration, not by changing code. City, event type, season and language are filters in the data model from day one | `cities` and `event_types` lookup tables, `events.season` tag, next-intl message files (BR-09) |
| NFR-SCAL-04 | Scale up for the event season and back down after, to control cost                                                                                                                      | Usage-based pricing on Vercel and Supabase; downgrade compute after October                    |

## Availability and Reliability

| ID         | Requirement                                           | Target                                                         | Stack notes                                                        |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| NFR-AVL-01 | Availability of the public site                       | 99.5% monthly                                                  | Requires paid tiers: Supabase free projects pause after inactivity |
| NFR-AVL-02 | Planned maintenance                                   | Outside the sponsorship sales peak and never during event days |                                                                    |
| NFR-AVL-03 | Data backup                                           | Daily automated backups, with restore tested before launch     | Supabase Pro includes daily backups; the free tier does not        |
| NFR-AVL-04 | Recovery point objective (maximum data loss)          | 24 hours in Stage 1                                            | Met by daily backups                                               |
| NFR-AVL-05 | Recovery time objective (maximum downtime to restore) | 4 hours in Stage 1                                             | Write and rehearse a restore runbook                               |

## Security

| ID         | Requirement                                                                                                                                     | Stack notes                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SEC-01 | All traffic uses HTTPS (TLS). No sensitive data over plain HTTP                                                                                 | Vercel and Supabase serve HTTPS only                                                                                                                                                                                                                                                      |
| NFR-SEC-02 | Phone OTP for signup and login, with rate limiting and lockout against OTP abuse and brute force                                                | Supabase Auth rate limits; exact thresholds are an open item                                                                                                                                                                                                                              |
| NFR-SEC-03 | Role-based access control for organizer, sponsor, general user and admin. A user only sees and changes their own data. Admin actions are logged | RLS on every table, guard triggers, `audit_log`. Admin roles: one super admin (manages admins, the support permission and fee settings), several admins, and support admins who also handle payment errors (SRS BR-13, BR-16). No day-to-day or emergency task depends on the super admin |
| NFR-SEC-04 | Secrets stored hashed where used; API keys and secrets never in the repository                                                                  | `.env.local` is git-ignored; service-role key used only in server code                                                                                                                                                                                                                    |
| NFR-SEC-05 | Protection against common web vulnerabilities (injection, XSS, CSRF, broken access control), with a security review before launch               | Zod validation on the server for every input                                                                                                                                                                                                                                              |
| NFR-SEC-06 | Input validation and size limits on all uploads; files scanned or restricted by type                                                            | Private storage buckets with type and size limits, set in migrations. Government authority letters (SRS FR-EVT-09): private bucket, PDF only, up to 5 MB (enforced by the bucket and on the server), readable only by the event's organizer and admins through short-lived signed URLs    |
| NFR-SEC-08 | Chat and contact sharing include a way to report and block users; phone sharing can be restricted at early deal stages                          | Phone numbers hidden until `interests.contact_shared = true`. Report and block need a new migration (SRS FR-CHT-05)                                                                                                                                                                       |
| NFR-SEC-09 | Protection against fake listings and fake accounts through the verification flow                                                                | Phone OTP, organizer verification, admin approval before publishing                                                                                                                                                                                                                       |

Project rules that implement these requirements (see `.cursor/rules/database-security.mdc`):

- RLS is never disabled; policies live in the same migration as the table.
- Role, user ID and status are never trusted from the client.
- OTPs, tokens, phone numbers and payment details are never logged.

## Privacy and Compliance

| ID         | Requirement                                                                                                                                                                               | Stack notes                                                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-CMP-01 | Comply with India's Digital Personal Data Protection Act, 2023: collect only needed data, take clear consent, let users view, correct and delete their data, and publish a privacy policy | Needs consent at signup, account deletion, and a privacy policy page. Not yet in the SRS screen list                                                                                                                                                          |
| NFR-CMP-02 | Payments go through an RBI-authorised payment gateway. Card and bank data is handled by the gateway and never stored by the platform                                                      | Applies to Stage 1 fees: Razorpay Standard Checkout, so card and UPI details never touch our servers. Split settlement is a Stage 3 need (Razorpay Route)                                                                                                     |
| NFR-CMP-03 | Issue valid GST invoices for platform fees                                                                                                                                                | The organizer's ₹100 listing fee includes GST; the sponsor's ₹500 subscription is charged plus GST. Receipts show taxable value and GST separately (SRS FR-FEE-05, BR-11). GSTIN and rate are not available yet; receipts omit the GSTIN until they are added |
| NFR-CMP-06 | Terms of service state the fee, refund and dispute rules                                                                                                                                  | Needed before fees are collected                                                                                                                                                                                                                              |

**(updated 10 Nov 2026)** Stage 1 fees are non-refundable, including when an event is rejected or cancelled; a rejected event is resubmitted without paying again (SRS BR-07). The only refunds are corrections of payment errors, handled by support admins (SRS BR-16). The NFR document's refund exception for rejected listings (NFR-PAY-05) no longer applies.

## Payments (Stage 1 platform fees)

Online fee collection through Razorpay is in Stage 1 (decided 10 Nov 2026), running in Razorpay test mode for now. Organizers pay ₹100 per event, GST included, to submit the event for review; an admin then reviews it within 48 hours and publishes or rejects it. Only sponsors pay a subscription: ₹500 per year plus GST. The listing fee must be paid at least 7 days before the event starts (SRS BR-10, BR-11, BR-12). These requirements from the NFR document apply to both fees.

| ID         | Requirement                                                                                                                               | Stack notes                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-PAY-01 | Every payment is idempotent. A retry or double-click never charges a user twice                                                           | One Razorpay order per fee. Unique indexes on `platform_fees.gateway_order_id` and `gateway_payment_id` (new migration). The webhook handler ignores events it has already processed                                                       |
| NFR-PAY-02 | Payment state (pending, paid, failed, refunded) is reconciled automatically with the gateway, and mismatches are flagged for admin review | Webhooks update `platform_fees`. A scheduled job fetches orders still `pending` after a set time from the Razorpay API                                                                                                                     |
| NFR-PAY-05 | Refunds follow the refund policy                                                                                                          | Stage 1 fees are never refunded (SRS BR-07), except to correct a payment error such as a duplicate charge. A support admin refunds in the Razorpay dashboard and marks the fee refunded in the app; both are logged (SRS BR-16, FR-ADM-05) |

Project rules for payments (see `.cursor/rules/database-security.mdc`):

- The webhook handler verifies the `X-Razorpay-Signature` header with the webhook secret before doing anything.
- Payment status changes only in server code with the service role, never from the client.
- `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server-only. Only the key ID may reach the browser.
- Stage 1 uses Razorpay test mode keys (`rzp_test_...`). Live keys are added only when live mode is switched on.
- The payment deadline is checked on the server when the Razorpay order is created. The database allows an event into review only when a paid listing fee exists. The client is never trusted for either.
- Fee amounts and the GST rate come from the settings table, which only the super admin can change, and every change is written to `audit_log`.

## Usability, Accessibility and Localization

| ID         | Requirement                                                                                                                            | Stack notes                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| NFR-USE-01 | Mobile-first design; key flows work well on small screens and mid-range Android phones                                                 |                                                      |
| NFR-USE-02 | Multiple languages from the start (English, Gujarati, Hindi), with all text outside the code. User content stays in the language typed | next-intl (`messages/en.json`, `hi.json`, `gu.json`) |
| NFR-USE-03 | An organizer can create a listing with packages in under 10 minutes without help                                                       |                                                      |
| NFR-USE-05 | Basic accessibility: readable font sizes, sufficient colour contrast, labels for form fields and buttons                               | shadcn/ui components                                 |
| NFR-USE-06 | Lightweight pages and images for limited data and average networks                                                                     | Next.js image optimisation                           |

## Maintainability and Observability

| ID         | Requirement                                                                                                         | Stack notes                                                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-MNT-01 | Version control, automated build and deployment, separate development, test and production environments             | GitHub plus Vercel preview and production deployments; a separate Supabase project for production                                                                                                                                                                 |
| NFR-MNT-02 | Automated tests cover the critical flows: signup, listing, interest and chat                                        | Vitest and React Testing Library. No tests exist yet                                                                                                                                                                                                              |
| NFR-MNT-03 | Central logging, error tracking and basic monitoring with alerts for downtime, payment failures and unusual traffic | Vercel and Supabase logs. Error tracking needs an extra tool — see Open Items. Razorpay dashboard alerts for failed payments and webhook delivery failures. Overdue reviews (48 hours) email the super admin daily until reviewed, through Resend (SRS FR-ADM-14) |
| NFR-MNT-04 | Admin panel for listing approval, user verification and reporting, so common operations need no developer           | SRS FR-ADM. The super admin adds admins and changes fees without a developer (FR-ADM-09, FR-ADM-10)                                                                                                                                                               |
| NFR-MNT-05 | Configuration such as fees is stored as settings, not hard-coded                                                    | No settings table yet                                                                                                                                                                                                                                             |

## Data

| ID         | Requirement                                                                                    | Stack notes                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-DAT-01 | Data supports reports by city, event type, season and sponsor                                  | Foreign keys to `cities` and `event_types`; `events.season`                                                                                                  |
| NFR-DAT-02 | Deleted or deactivated users and events do not break historical financial records              | `platform_fees.event_id` is `on delete set null`, but `platform_fees.user_id` has no cascade rule, so deleting a user with fees fails. Decide on soft delete |
| NFR-DAT-03 | Data retention and deletion periods defined per data type and documented in the privacy policy | Periods to be confirmed                                                                                                                                      |

## Cost Constraints

| ID         | Requirement                                                                                                                   | Stack notes                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| NFR-CST-01 | Monthly infrastructure and tooling cost in Stage 1 stays small enough to be covered by listing fees and sponsor subscriptions | Development can use free tiers. Production needs Supabase Pro (backups, no pausing) and Vercel Pro (Hobby is non-commercial only) |
| NFR-CST-02 | Prefer managed services and usage-based pricing so cost follows load                                                          |                                                                                                                                   |
| NFR-CST-03 | Track and cap messaging costs (SMS, OTP, email)                                                                               | SMS OTP is a major recurring cost; set provider spend limits                                                                      |

Razorpay charges a per-transaction fee (roughly 2% on standard methods) on each platform fee, with no fixed monthly cost.

Allowed services in Stage 1: Vercel, Supabase, Razorpay (platform fees), an SMS provider for OTP, and Resend for transactional email (admin alerts; approved 10 Nov 2026, free tier of 3,000 emails a month). Ask before adding any other service.

## Later Stages (reference only, do not build in Stage 1)

- **Stage 2:** NFR-PERF-04 (ticket confirmation under 5 s), NFR-PERF-05 (QR scan under 1 s), NFR-SCAL-03 (no overselling), NFR-AVL-01 (99.9% in the event window), NFR-AVL-06 (offline gate entry), NFR-SEC-07 (signed single-use QR passes), NFR-USE-04 (quick ticket flow).
- **Stage 3:** NFR-AVL-04 and AVL-05 tighten to 15 minutes and 1 hour once deal payments start; NFR-CMP-02 split settlement (Razorpay Route); NFR-CMP-03 invoices and TDS documents for deals; NFR-CMP-04 (financial record retention); NFR-CMP-05 (PAN and bank details via gateway onboarding); NFR-PAY-03 (instalment schedule) and NFR-PAY-04 (organizer payout preview). NFR-PAY-01 and PAY-02 already apply to Stage 1 fees and extend to deal payments.

## Open Items

From the NFR document:

- Target scale for the first version (organizers, sponsors, events for Navratri 2027).
- Monthly infrastructure budget for Stage 1.
- Languages beyond English, Gujarati and Hindi.
- Data retention periods, to be confirmed with an accountant and legal advisor.

Raised by checking the NFRs against the chosen stack:

- **Hosting tiers:** production needs Supabase Pro (daily backups, no pausing; NFR-AVL-01, AVL-03) and Vercel Pro (Hobby is non-commercial only).
- **Region:** confirm the Supabase project region is Mumbai (`ap-south-1`) for NFR-PERF-03.
- **SMS provider:** phone OTP needs an SMS provider (for example MSG91, Twilio or Textlocal) and TRAI DLT registration of the sender ID and templates. DLT registration can take weeks, so start early.
- **Error tracking:** NFR-MNT-03 needs a tool beyond Vercel and Supabase logs; choose one or accept logs only for Stage 1.
- **DPDP screens:** consent, account deletion and the privacy policy (NFR-CMP-01) are missing from the SRS screen list.
- **Razorpay live mode:** Stage 1 runs on test mode. Live mode needs business KYC, which can take several days, so start it before launch.
- **GST details (not available yet):** the platform's GSTIN and the GST rate (18% is typical for online services). At 18% the sponsor pays ₹590. Before live mode, confirm GST registration with an accountant: an unregistered business cannot charge GST, so the sponsor's "plus GST" amount cannot be collected until it is.
- **Domain (to buy later):** the planned domain is `eventsponsors.com`. Until it is purchased, the app runs on Vercel's default `vercel.app` address, and Resend sends from its test sender, which delivers only to the account owner, so the Resend account is created with the super admin's email. After purchase, add the domain in Vercel and Supabase Auth, and verify a sending subdomain such as `mail.eventsponsors.com` in Resend (SPF and DKIM DNS records). See SRS Open Items.
- **Financial record retention (NFR-CMP-04):** the NFR document places this in Stage 3, but fee records start in Stage 1. Confirm the retention period with an accountant.

Resolved on 10 Nov 2026 (see the SRS Decisions section): payments in Stage 1 through Razorpay in test mode; the organizer pays the listing fee (GST included) at least 7 days before the event, then an admin reviews within 48 hours; no refunds; only sponsors have a subscription (plus GST); one super admin and several admins; rejected events can be resubmitted any time before they start; edits to published events are reviewed by an admin; optional government authority letter per event; overdue reviews email the super admin daily until reviewed, sent through Resend; the platform does not depend on the super admin for daily or emergency work; support admins handle payment errors.
