# Business Model

Source: `docs/Event Sponsorship Marketplace Business Model.pdf` in the parent `Event Platform` folder.

## Concept

A platform where event organizers list their events and sponsorship packages, sponsors browse and contact them directly, and both sides arrange meetings and close deals in one place. Later, transactions will also happen inside the app.

## Target Segment

- **Starting point:** Navratri and Garba in Gujarat. Almost every society and club organizes one, so there are many organizers and many sponsors.
- **Sales window:** sponsorship deals close 2 to 3 months before the event (July to September). The next opportunity is Navratri 2027.
- **Expansion:** Diwali fairs, Uttarayan, Ganesh Utsav, wedding expos, then festivals in other states such as Durga Puja, Pongal, Onam and Chhath. The goal is all of India.
- **Seasonality:** festivals in different states keep events coming throughout the year.
- Built multi-city and multi-language from the start. Each new city should have a local partner or ambassador.

## User Types

| User             | Role                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organizer**    | Lists events and sponsorship packages; seeks sponsors                                                                                              |
| **Sponsor**      | Browses events, expresses interest, talks to organizers                                                                                            |
| **General user** | Browses public events. Buys tickets or passes from Stage 2                                                                                         |
| **Admin**        | Verifies organizers and approves listings. One super admin also manages admin accounts and fee settings; support admins also handle payment errors |

For each event the organizer picks one of three options: ticketed and open to everyone, free but public, or fully private (not visible to general users; the sponsorship part still works). Ticketing is a Stage 2 feature.

## Revenue Model

| Source                    | Amount                                      | Notes                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizer listing fee     | ₹100 per event (10,000 paise), GST included | Also reduces fake listings. Organizers pay per event and have no subscription. Paid online through Razorpay to submit the event for review, at least 7 days before it starts. An admin reviews within 48 hours. Non-refundable; a rejected event is resubmitted free |
| Sponsor subscription      | ₹500 per year (50,000 paise) plus GST       | Sponsors only (₹590 at 18% GST). Paid online through Razorpay. First-year launch offer under consideration (₹50 to ₹100, or free or half price for the first 100 sponsors)                                                                                           |
| Deal commission (later)   | 1 to 5 percent of each confirmed deal       | Not in Stage 1 (BR-08)                                                                                                                                                                                                                                               |
| Ticket commission (later) | 1 to 5 percent of each ticket sale          | Deducted from the organizer's share; the buyer pays the listed price with no extra fee                                                                                                                                                                               |

Early goal: cover platform costs only (server, domain, SMS or email, payment gateway fees). Estimate: 1,000 sponsors bring about ₹5 lakh per year in subscriptions.

## Development Stages

| Stage                 | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage 1 (current)** | Skeleton with no deal payments. **(updated 10 Nov 2026)** The platform's own fees (listing fee and sponsor subscription) are collected online through Razorpay. Organizer and sponsor signup (sponsors on a single basic plan), event listing with packages, browse and filters, interest button, chat or contact sharing, admin panel with light organizer verification: phone OTP at signup; organizer name, society or club name, venue, and a social media link or past event photo; manual admin approval before a listing goes live. General users can browse public events without buying tickets |
| **Stage 2**           | Premium sponsor plan, deal status tracking, reviews and ratings, verified badge, general user accounts and ticket purchase with QR entry pass (ticketing can move earlier if Navratri 2027 needs it)                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Stage 3**           | Deal payments, invoices, GST and instalment release through Razorpay Route, with full organizer verification (PAN and bank account through the payment gateway's onboarding) before an organizer can receive money or sell tickets                                                                                                                                                                                                                                                                                                                                                                       |

## Cash Challenge

Many organizers deal in cash to save on tax, pay local vendors and avoid fees, which is why Stage 1 has no deal payments. Large and corporate sponsors need invoices, GST bills and TDS receipts, so starting with them pushes organizers online. The small platform fees are still collected online in Stage 1, because they are paid to the platform and do not touch the deal money.

## Payment Flow (Stage 3)

- The sponsor deposits the full deal amount on the platform when the deal is confirmed.
- Instalments to the organizer: 40 to 50% immediately or within a few days, 30 to 40% just before or on the event day, and 10 to 20% after the event once proof (photos, footfall report) is received.
- If the event is cancelled, unreleased instalments go back to the sponsor and the platform mediates on released amounts.
- The payment gateway must support split payments so organizer funds never sit in the platform's own account. Razorpay was chosen on 10 Nov 2026, and Razorpay Route provides this.

## Open Questions

From the Business Model document:

- Second-year subscription price, and the first-year launch offer.
- Detailed refund and dispute policy, including whether the commission is refunded when a ticketed event is cancelled.
- How ticket QR codes are validated at the gate, including offline scanning.
- Target scale for the first version (organizers, events and ticket buyers for Navratri 2027).

Decided on 10 Nov 2026 (see `docs/srs-stage1.md`, Decisions):

- **Stage 1 fees:** collected online through Razorpay, in test mode for now. Organizers pay ₹100 per event with GST included; only sponsors have a subscription, at ₹500 per year plus GST.
- **Listing flow:** the organizer pays the listing fee to submit the event, no later than 7 days before its start date. An admin then reviews it within 48 hours and publishes or rejects it. Sponsors can interact only with published events. A rejected event is fixed and resubmitted without paying again, at any time before it starts; the 7-day deadline applies only to the first payment. Edits to a published event go to admin review, and the published version stays live until they are approved. Stage 1 fees are never refunded, except to correct a payment error.
- **Supporting document:** each event can carry an optional letter from a government authority (for example police or municipal permission), visible only to the organizer and admins.
- **Admin roles:** one super admin, who manages admin accounts, the support permission and fee settings, and several admins. Admins with the support permission also handle payment errors, the only case where a fee is refunded. The platform does not depend on the super admin for daily or emergency work; overdue reviews (48 hours) email the super admin.
- **GST:** the GSTIN and rate are not available yet. Confirm GST registration before live mode, because the sponsor's "plus GST" amount can only be charged by a registered business.

Still in conflict with the SRS:

- **Verified badge:** the SRS puts it in Stage 1 (FR-ORG-04); this document lists it in Stage 2.
