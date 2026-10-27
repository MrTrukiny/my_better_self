# My Better Self

A personal, installable PWA that plans household cleaning with AI and schedules daily 45-minute sessions in Google Calendar. Built with Next.js 16.

## Getting started

### 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) and add a `development` branch.
2. Copy that branch's **pooled** connection string. It goes in `DATABASE_URL`.

### 2. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and configure the OAuth consent screen (External, with your account as a test user while it is in Testing).
2. Under **APIs & Services > Credentials**, create an **OAuth client ID** of type **Web application** and add these authorized redirect URIs:
   - `http://localhost:4837/api/auth/callback/google` (`pnpm dev` and `pnpm start`)
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

Open http://localhost:4837 and sign in with an email listed in `ALLOWED_EMAILS`. To test PWA behavior (service worker, offline), use a production build: `pnpm build && pnpm start`.

### 4. AI task proposals (optional)

Task proposals use Gemini. Create a key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`. Without it, "Propose tasks" shows an error. `AI_MODEL` overrides the default Flash model, and `AI_FAKE=1` swaps Gemini for deterministic proposals (used by e2e and CI).

### 5. Google Calendar and deployment

Connecting Google Calendar (on the schedule page) needs the Calendar API enabled and three calendar scopes on the consent screen; `CALENDAR_FAKE=1` swaps in an in-memory calendar (used by e2e and CI). Production setup on Vercel, including the daily job and `CRON_SECRET`, is in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Scripts

- `pnpm check:fast`: typecheck, lint, unit tests
- `pnpm check`: everything above plus Playwright e2e (needs `DATABASE_URL`; it runs migrations first; `E2E_PORT` picks a port other than 3100)
- `pnpm db:generate`: create a migration in `drizzle/` from schema changes in `src/db/schema/`
- `pnpm db:migrate`: apply pending migrations to `DATABASE_URL`
- `pnpm ai:try`: run the live prompt against Gemini with a sample home and print the proposals (needs the API key)

## Working with AI agents

Start with [`AGENTS.md`](AGENTS.md). Product context is in [`docs/PRODUCT.md`](docs/PRODUCT.md), and features are specified in [`docs/specs/`](docs/specs/).
