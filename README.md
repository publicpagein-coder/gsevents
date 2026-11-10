# GS Events — Event Sponsorship Marketplace

A mobile-first web platform connecting event organisers and sponsors, with built-in admin verification, in-app chat, and multilingual support (English, Hindi, Gujarati). First market: Navratri and Garba events in Gujarat.

## Stack

| Layer | Choice |
|-------|--------|
| Web app | Next.js 14 (App Router), TypeScript strict mode |
| UI | Tailwind CSS + shadcn/ui |
| Backend / DB / Auth | Supabase (Postgres, Auth phone OTP, Storage, Realtime) |
| i18n | next-intl — English (en), Hindi (hi), Gujarati (gu) |
| Validation | Zod |
| Testing | Vitest + React Testing Library |
| Hosting | Vercel |

## Prerequisites

- **Node.js 20+** (`node --version`)
- **pnpm** (`npm install -g pnpm` or see [pnpm.io](https://pnpm.io))
- **Supabase CLI** (`pnpm add -g supabase` — requires Docker Desktop for local dev)
- **Docker Desktop** (for `supabase start`)

## Local Setup

```bash
# 1. Clone
git clone https://github.com/publicpagein-coder/gsevents.git
cd gsevents

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY

# 4. Start local Supabase (requires Docker Desktop)
supabase start
# Copy the output credentials into .env.local

# 5. Apply database migration
supabase db push
# or: supabase migration up

# 6. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you should be redirected to `http://localhost:3000/en`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript check (must pass with 0 errors) |
| `pnpm lint` | ESLint check |
| `pnpm format` | Prettier format |
| `pnpm test` | Run Vitest tests |

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

After running `supabase start` and applying migrations:

```bash
supabase gen types typescript --local > src/lib/supabase/types.ts
```

## Documentation

| File | Contents |
|------|----------|
| [`docs/business-model.md`](docs/business-model.md) | User types, revenue model, 3 stages, payment flow, open questions |
| [`docs/nfr.md`](docs/nfr.md) | Performance targets, availability, security rules, compliance, cost |
| [`docs/srs-stage1.md`](docs/srs-stage1.md) | Full functional requirements, business rules, screen list, out-of-scope |
| [`docs/database-design.md`](docs/database-design.md) | Table dictionary, enums, relationships, RLS rules, triggers, seed data |

## Key Conventions

- **Money:** stored as integer paise; shown as rupees in the UI (`formatRupees()` in `src/lib/utils.ts`).
- **No hardcoded UI text:** every string goes through `next-intl` message files.
- **Service-role key:** only in `src/lib/supabase/admin.ts` and server-side code — never in the browser.
- **RLS:** enabled on every table; never disabled.
- **Migrations:** never edit an applied migration; add a new one instead.
