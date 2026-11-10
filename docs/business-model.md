# Business Model

## Three User Types

| User | Role |
|------|------|
| **Organizer** | Lists events and sponsorship packages; seeks sponsors |
| **Sponsor** | Browses events, expresses interest, chats with organizers |
| **General User** | Browses public events without an account (no ticket purchase in Stage 1) |
| **Admin** | Verifies organizers, approves/rejects listings, maintains audit log |

## Revenue Model

| Fee | Amount | Trigger |
|-----|--------|---------|
| Event listing fee | ₹100 (10,000 paise) | Organizer submits an event for review |
| Sponsor subscription | ₹500/year (50,000 paise) | Sponsor activates annual plan |

- **Stage 1:** Only these two flat fees; no deal commission.
- **Stage 3:** Razorpay Route or Cashfree split-settlement for sponsor-to-organizer payments, with instalment releases and GST/TDS handling.

## Three Stages

| Stage | Scope |
|-------|-------|
| **Stage 1 (current)** | Web app (mobile-first): organizer & sponsor signup, event listings, browse/filter, sponsor interest, in-app chat, admin approval, platform fees |
| **Stage 2** | Premium sponsor plan, deal tracking, reviews/ratings, general user accounts, ticket purchase, QR entry passes, React Native Android app |
| **Stage 3** | Razorpay Route / Cashfree split-settlement, instalment releases, invoices, GST, TDS |

## Payment Flow (Stage 1 outline)

1. Organizer creates an event (status: `draft`).
2. Organizer pays ₹100 listing fee via gateway → `platform_fees` row created with `fee_type = event_listing`.
3. On payment webhook confirmation (service-role only), event status moves to `pending_review`.
4. Admin approves → event status set to `published`.
5. Sponsor may subscribe at ₹500/yr → `platform_fees` row with `fee_type = sponsor_subscription`; `sponsor_profiles.plan` updated by service role.
6. Stage 1 fees are non-refundable, **except** the listing fee when the platform rejects the listing (BR-07).

## Key Open Questions

- **Payment gateway:** Razorpay vs. Cashfree for Stage 1 fee collection (not yet decided).
- **Refund flow:** How to initiate listing-fee refunds on rejection — manual or automated?
- **OTP rate limiting:** Exact limits and lockout duration not specified yet.
- **Subscription renewal:** Auto-renew vs. manual renewal for sponsor subscription.
- **Admin provisioning:** Process for creating admin accounts (outside the app UI).
