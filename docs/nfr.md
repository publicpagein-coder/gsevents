# Non-Functional Requirements (NFR)

## Performance Targets

| ID | Target | Notes |
|----|--------|-------|
| NFR-PERF-01 | Page load < 3 s on mid-range phone over 4G | Mobile-first; keep pages lightweight |
| NFR-PERF-02 | Search/filter response < 1 s | Covered by `events_browse_idx` composite index |
| NFR-PERF-03 | API P95 < 500 ms | Supabase-hosted Postgres on Vercel edge functions |

Strategies: optimised images (AVIF/WebP), paginated list endpoints, minimal JavaScript bundles, Tailwind CSS purged in production.

## Availability

| ID | Target |
|----|--------|
| NFR-AVL-01 | 99.5% monthly uptime |

Hosting on Vercel (web) + Supabase cloud (DB/Auth). Both offer SLAs above this target.

## Security Rules

| Rule | Detail |
|------|--------|
| RLS on every table | Never disabled; policies in the same migration as the table |
| Service-role key | Server-only (route handlers, server actions, webhooks); never in client bundle or logs |
| Auth | Phone OTP via Supabase Auth; rate-limit OTP requests and verification attempts |
| Role checks | Validated server-side for every sensitive action; never trust client-sent role/userId |
| Guard triggers | DB triggers prevent users from self-modifying role, verification status, plan, subscription dates, and event status beyond allowed transitions |
| Contact sharing | Phone numbers never returned unless `interests.contact_shared = true` |
| File uploads | Validate type and size; private storage buckets unless file must be public |
| OTP / tokens | Never logged |

## Compliance Notes

- Payments and invoices (Stage 3) will require GST, TDS, and PAN/bank verification via payment gateway.
- No PII (phone numbers, payment details) in logs.
- Private events visible to sponsors only (not to unauthenticated visitors).

## Cost Constraints

- Stage 1 targets Supabase free tier / Pro tier; Vercel Hobby / Pro tier.
- No third-party services beyond Supabase, payment gateway, and Vercel in Stage 1.
- New cities, event types, and seasons are added as seed data rows — not new code deployments.
