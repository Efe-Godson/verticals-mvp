# Verticals Forms

A React + Vite app for building custom data-collection forms, managing submissions, and generating AI-assisted analytics reports on the collected data. Backed by [Supabase](https://supabase.com) (Postgres, Auth, Edge Functions) and deployed as a static SPA on Vercel.

## Stack

- React 19 + Vite, plain JavaScript (JSX), `react-router-dom` for client-side routing
- Supabase for auth, database, and Edge Functions
- Gemini (via Supabase Edge Functions) for AI report analysis and Q&A
- `recharts`, `jspdf`/`jspdf-autotable`, `pptxgenjs`, `xlsx`, `html2canvas` for charts and report/data export
- `oxlint` for linting, `vitest` for unit tests

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values below
npm run dev
```

### Environment variables

Create a `.env` file at the project root with:

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

These are safe to expose client-side (they're the public anon key, scoped by Supabase Row Level Security).

### Google Sheets export

"Open in Google Sheets" on Records uses Supabase's Google OAuth session rather than a separate client-side flow. Login (`supabase.auth.signInWithOAuth`) only ever requests `openid email profile`. The first time someone clicks "Open in Google Sheets" without a Google session that's already granted Sheets/Drive access, `recordsExport.js` triggers its own `signInWithOAuth` call requesting `spreadsheets` and `drive.file` scopes and redirects back to the page; once that grant exists, `session.provider_token` is used directly as the Sheets API bearer token on every subsequent export. This needs Google configured as an OAuth provider in the Supabase dashboard (Authentication → Providers → Google) with the Sheets and Drive APIs enabled on the underlying Google Cloud project — no separate `VITE_GOOGLE_CLIENT_ID` is used.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run lint` — run oxlint
- `npm test` — run the vitest suite

## Supabase Edge Functions

The AI analysis features live in `supabase/functions/`:

- `ai-analyst` — generates a structured business analysis (summary, insights, recommendations, anomalies, forecasts) for a form's submissions
- `ai-ask` — answers ad-hoc questions about a form's submissions
- `_shared/stats.ts` — shared stats-building helpers used by both functions

To deploy a function:

```bash
supabase functions deploy ai-analyst
supabase functions deploy ai-ask
```

Both functions need a `GEMINI_API_KEY` secret:

```bash
supabase secrets set GEMINI_API_KEY=your_key
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every Edge Function — no need to set them yourself.

## Deployment

The app is deployed to Vercel as a static SPA (`vercel.json` rewrites all routes to `index.html` for client-side routing). Set the two `VITE_SUPABASE_*` environment variables in the Vercel project settings.
