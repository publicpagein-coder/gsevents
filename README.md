# GS Events — 

A mobile-first web platform connecting event organisers and sponsors, with built-in admin verification, in-app chat, and multilingual support (English, Hindi, Gujarati). First market: Navratri and Garba events in Gujarat.

## Stack

| Layer               | Choice                                                 |
| ------------------- | ------------------------------------------------------ |
| Web app             | Next.js 14 (App Router), TypeScript strict mode        |
| UI                  | Tailwind CSS + shadcn/ui                               |
| Backend / DB / Auth | Supabase (Postgres, Auth phone OTP, Storage, Realtime) |
| i18n                | next-intl — English (en), Hindi (hi), Gujarati (gu)    |
| Validation          | Zod                                                    |
| Testing             | Vitest + React Testing Library                         |
| Hosting             | Vercel                                                 |

## Prerequisites

- **Node.js 20+** (`node --version`)
- **pnpm** (`npm install -g pnpm` or see [pnpm.io](https://pnpm.io))
- A **Supabase cloud project** (default), or **Docker Desktop** plus the **Supabase CLI** for a fully local database

## Local Setup (Supabase cloud project, no Docker)

```bash
# 1. Clone
git clone https://github.com/publicpagein-coder/gsevents.git
cd gsevents

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Fill in from Supabase dashboard → Project Settings → API:
#   NEXT_PUBLIC_SUPABASE_URL        (Project URL)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY   (publishable key, sb_publishable_...)
#   SUPABASE_SERVICE_ROLE_KEY       (secret key, sb_secret_... — server only)

# 4. Apply the database migration (first time only)
# Paste supabase/migrations/20261109000000_stage1_schema.sql into the
# Supabase SQL Editor and run it, or:
#   npx supabase link --project-ref <project-ref>
#   npx supabase db push

# 5. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you should be redirected to `http://localhost:3000/en`.

To check the migration was applied, the `cities` and `event_types` tables in the Supabase Table Editor should contain seed rows.

Phone sign-in is off by default in a new Supabase project. When the sign-in screens are built, enable the Phone provider (Authentication → Sign In / Providers) and add test phone numbers with fixed OTPs so development does not send real SMS.

## Alternative: fully local Supabase (requires Docker Desktop)

```bash
npx supabase start      # prints local URL and keys; copy them into .env.local
npx supabase db reset   # applies migrations and seed data to the local database
pnpm dev
```

## Available Scripts

| Script           | Description                                |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Start development server                   |
| `pnpm build`     | Production build                           |
| `pnpm typecheck` | TypeScript check (must pass with 0 errors) |
| `pnpm lint`      | ESLint check                               |
| `pnpm format`    | Prettier format                            |
| `pnpm test`      | Run Vitest tests                           |

## Folder Structure

```
src/
  app/
    [locale]/           ← locale prefix: /en, /hi, /gu
      layout.tsx        ← wraps with NextIntlClientProvider
      page.tsx          ← public home page
      (auth)/           ← sign-in and sign-up screens
      (organizer)/      ← organiser dashboard
      (sponsor)/        ← sponsor dashboard
      admin/            ← admin panel
  components/
    LanguageSwitcher.tsx
    ui/                 ← shadcn/ui components
  lib/
    supabase/
      client.ts         ← browser client (anon key)
      server.ts         ← server client (user session + cookies)
      admin.ts          ← service-role client (server-only!)
      types.ts          ← generated DB types (run supabase gen types)
    utils.ts
  i18n/
    routing.ts          ← locale list and default locale
    request.ts          ← next-intl server config
    navigation.ts       ← typed Link, useRouter, usePathname
  middleware.ts         ← next-intl locale routing middleware
messages/
  en.json
  hi.json
  gu.json
supabase/
  config.toml
  migrations/
    20261109000000_stage1_schema.sql
.cursor/
  rules/
    project-context.mdc
    database-security.mdc
docs/
  business-model.md
  nfr.md
  srs-stage1.md
  database-design.md
```

## Regenerating DB Types

From the cloud project (needs `npx supabase login` first):

```bash
npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/types.ts
```

Or from a local Supabase started with Docker:

```bash
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

## Documentation

The master documents (PDF and Word) live in the `docs` folder one level above this repository. The files below are the working copies, using the same requirement IDs.

| File                                                 | Contents                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/business-model.md`](docs/business-model.md)   | Concept, user types, revenue model, 3 stages, payment flow, open questions                                                          |
| [`docs/nfr.md`](docs/nfr.md)                         | Stage 1 NFRs (performance, availability, security, privacy, usability, maintainability, data, cost) with stack notes and open items |
| [`docs/srs-stage1.md`](docs/srs-stage1.md)           | Stage 1 functional requirements with priorities, user stories, business rules, screens, external interfaces, open items             |
| [`docs/database-design.md`](docs/database-design.md) | Table dictionary, enums, relationships, RLS rules, triggers, seed data                                                              |

## Key Conventions

- **Money:** stored as integer paise; shown as rupees in the UI (`formatRupees()` in `src/lib/utils.ts`).
- **No hardcoded UI text:** every string goes through `next-intl` message files.
- **Service-role key:** only in `src/lib/supabase/admin.ts` and server-side code — never in the browser.
- **RLS:** enabled on every table; never disabled.
- **Migrations:** never edit an applied migration; add a new one instead.
