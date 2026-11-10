# GSEvents — Event Sponsorship Marketplace

A two-sided marketplace connecting **event organizers** and **sponsors**, delivering both a mobile app and web platform for the Indian events market (Navratri, Garba, Diwali Fairs, and more).

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo |
| API | Node.js 20 + Express + TypeScript (strict) + Prisma ORM + PostgreSQL |
| Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Mobile | React Native + Expo SDK 51 + Hermes engine |
| Shared | TypeScript types + Zod schemas |
| Cache | Redis (ioredis) |

## Repository Structure

```
gsevents/
├── apps/
│   ├── api/          # Express REST API
│   ├── web/          # Next.js 14 web application
│   └── mobile/       # Expo React Native app
├── packages/
│   └── shared/       # Shared types, constants, Zod schemas
├── turbo.json
├── package.json
└── tsconfig.base.json
```

## Local Development

### Prerequisites

- Node.js 20+ (use `nvm use` from repo root)
- npm 10+
- PostgreSQL 15+
- Redis 7+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env

# 3. Edit apps/api/.env with your DATABASE_URL, REDIS_URL, JWT_SECRET, etc.

# 4. Push Prisma schema to database
npm run db:push --workspace=apps/api

# 5. Generate Prisma client
npm run db:generate --workspace=apps/api
```

### Running

```bash
# Run all apps in parallel (recommended)
npm run dev

# Run individual apps
npm run dev --workspace=apps/api      # API on port 4000
npm run dev --workspace=apps/web      # Web on port 3000
npm run dev --workspace=apps/mobile   # Expo dev server
```

### Building

```bash
# Build all packages and apps
npm run build

# Type-check all packages
npm run typecheck
```

## User Roles

| Role | Description |
|------|-------------|
| `ORGANIZER` | Creates events and sponsorship packages |
| `SPONSOR` | Browses events and expresses sponsorship interest |
| `GENERAL_USER` | Discovers public events, buys tickets |
| `ADMIN` | Platform administration and verification |

## Development Stages

- **Stage 1 (current):** Core marketplace — event listing, sponsorship packages, phone OTP auth, admin verification
- **Stage 2:** Premium subscriptions, deal tracking, ticket purchase with QR entry
- **Stage 3:** Payment gateway (Razorpay Route), split settlements, invoicing, GST/TDS

## Environment Variables

See `.env.example` in each app for required variables.

## License

Private — All rights reserved.
