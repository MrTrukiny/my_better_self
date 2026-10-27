# Deployment

How to put My Better Self in production on Vercel, with Google sign-in, Google Calendar sync, and the daily job. These steps are done by the owner in the Vercel and Google Cloud consoles; nothing here runs from the repo.

## 1. Production database (Neon)

1. In the Neon project, use the `main` branch (or create a `production` branch) for production. Keep the `development` branch for local work.
2. Copy both connection strings: the **pooled** one (hostname ends in `-pooler`) for `DATABASE_URL`, and the **direct** one for `DATABASE_URL_UNPOOLED`.
3. Apply the migrations from your machine, pointing at production only for this command:

   ```bash
   DATABASE_URL="<direct production URL>" pnpm db:migrate
   ```

   Run it again after every merge that adds a file in `drizzle/`, before or right after the deploy that needs it.

   With the Neon CLI, `neon connection-string <branch> --project-id <id>` prints the direct URL (add `--pooled` for the pooled one), so the secret never has to be pasted. If `drizzle-kit migrate` exits with code 1 and no message, run the same migrations with drizzle-orm's migrator, which prints the error:

   ```bash
   U="<direct production URL>" node -e 'const {Pool}=require("pg");const {drizzle}=require("drizzle-orm/node-postgres");const {migrate}=require("drizzle-orm/node-postgres/migrator");const pool=new Pool({connectionString:process.env.U});migrate(drizzle(pool),{migrationsFolder:"drizzle"}).then(()=>console.log("ok"),console.error).finally(()=>pool.end())'
   ```

## 2. Google Cloud

In the project that holds the OAuth client used for sign-in ([Google Cloud Console](https://console.cloud.google.com/)):

1. **Enable the Google Calendar API**: APIs & Services > Library > "Google Calendar API" > Enable.
2. **Redirect URI**: APIs & Services > Credentials > the OAuth client > Authorized redirect URIs, add `https://<your-domain>/api/auth/callback/google`. Connecting the calendar uses the same callback as sign-in.
3. **Scopes**: OAuth consent screen (Google Auth Platform > Data access) > Add or remove scopes, add:
   - `https://www.googleapis.com/auth/calendar.app.created`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.freebusy`
4. **Branding**: app name, support and developer contact emails, home page `https://<your-domain>`, privacy policy `https://<your-domain>/privacy`, terms `https://<your-domain>/terms`, and `<your-domain>` under Authorized domains. Leave the logo empty: uploading one requires verification. Publishing stays disabled until this page is complete.
5. **Publishing status**: Audience > Publish app, so the status is **In production**. It can stay unverified for personal use: Google shows an "unverified app" warning when you connect the calendar, which you accept with "Advanced > Go to My Better Self". In **Testing**, refresh tokens expire after 7 days and the daily job stops working.

## 3. Vercel project

1. Import the GitHub repository in Vercel (framework preset: Next.js; build command and output are detected). Use Node 24.
   - **Domain**: the public production domain is the one under Settings > Domains (for example `my-better-self-tkn.vercel.app`). The `<project>-<team>.vercel.app` alias and per-deployment URLs sit behind Vercel's login, so don't use them for `BETTER_AUTH_URL` or the Google redirect URI. If you change the domain, update both and redeploy.
   - **Production only**: the app has no preview environment, so set Settings > Git > Ignored Build Step to `if [ "$VERCEL_ENV" = "production" ]; then exit 1; else exit 0; fi`. Otherwise every pull request gets a failed preview deployment, since its variables exist only in Production.
2. Set these environment variables for **Production**:

   | Variable                       | Value                                                               |
   | ------------------------------ | ------------------------------------------------------------------- |
   | `DATABASE_URL`                 | Neon pooled connection string (production branch)                   |
   | `DATABASE_URL_UNPOOLED`        | Neon direct connection string (production branch)                   |
   | `BETTER_AUTH_SECRET`           | A new secret: `openssl rand -base64 32` (don't reuse the local one) |
   | `BETTER_AUTH_URL`              | `https://<your-domain>`                                             |
   | `GOOGLE_CLIENT_ID`             | The OAuth client ID                                                 |
   | `GOOGLE_CLIENT_SECRET`         | The OAuth client secret                                             |
   | `ALLOWED_EMAILS`               | Comma-separated emails allowed to sign in                           |
   | `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key from Google AI Studio                                    |
   | `CRON_SECRET`                  | A new secret of at least 32 characters: `openssl rand -base64 32`   |

   Don't set `AI_FAKE` or `CALENDAR_FAKE` in Vercel; they are for tests only. Without `CRON_SECRET`, the app fails its environment check in Vercel production.
3. Deploy. Vercel reads `vercel.json` and registers the daily job (`/api/cron/daily`, once a day at 09:00 UTC; on the Hobby plan it may run any time within that hour). Vercel sends `Authorization: Bearer <CRON_SECRET>` with each run.

## 4. Check it works

1. Sign in on the production URL, save a schedule, and open **Schedule > Google Calendar > Connect Google Calendar**. Accept the consent screen.
2. The schedule page shows "Connected: Cleaning". In Google Calendar, a "Cleaning" calendar has one event per cleaning day at its start time, with the task list in the description.
3. Change a task or the schedule; the events follow within a few seconds.
4. Delete the "Cleaning" calendar in Google Calendar, then change anything in the plan: the calendar is created again.
5. Next day, check Vercel > the project > Logs (or Cron Jobs) for a `200` from `/api/cron/daily`. You can also trigger it by hand:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/daily
   ```

   It answers with the number of owners, how many synced, and how many failed. Failures are logged with `calendar sync failed`.

## Troubleshooting

- **"We couldn't update your calendar" with "Reconnect"**: Google rejected the stored grant (revoked from the Google account, the consent screen went back to Testing, or a scope was unchecked). Reconnect from the schedule page.
- **"We couldn't update your calendar" without "Reconnect"**: a temporary Google error. The next change or the daily job retries.
- **Connecting lands on "Google Calendar wasn't connected"**: the consent was cancelled, or one of the three calendar permissions was unchecked. Try again and keep all three checked.
