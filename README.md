# My Better Self

A personal, installable PWA that plans household cleaning with AI and schedules daily 45-minute sessions in Google Calendar. Built with Next.js 16.

## Getting started

### 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) and add a `development` branch.
2. Copy that branch's **pooled** connection string. It goes in `DATABASE_URL`.

### 2. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and configure the OAuth consent screen (External, with your account as a test user while it is in Testing).
2. Under **APIs & Services > Credentials**, create an **OAuth client ID** of type **Web application** and add these authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://localhost:3100/api/auth/callback/google` (production build used by e2e)
   - `https://<your-domain>/api/auth/callback/google` when deployed
3. Copy the client ID and secret.

### 3. Environment and first run

```bash
pnpm install
cp .env.example .env.local   # fill in every value; generate the secret with: openssl rand -base64 32
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 and sign in with an email listed in `ALLOWED_EMAILS`. To test PWA behavior (service worker, offline), use a production build: `pnpm build && pnpm start`.

## Scripts

- `pnpm check:fast`: typecheck, lint, unit tests
- `pnpm check`: everything above plus Playwright e2e (needs `DATABASE_URL`; it runs migrations first)
- `pnpm db:generate`: create a migration in `drizzle/` from schema changes in `src/db/schema/`
- `pnpm db:migrate`: apply pending migrations to `DATABASE_URL`

## Working with AI agents

Start with [`AGENTS.md`](AGENTS.md). Product context is in [`docs/PRODUCT.md`](docs/PRODUCT.md), and features are specified in [`docs/specs/`](docs/specs/).
