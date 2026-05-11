# Extropy take-home — Personal Expense Tracker (Option 1) + AI Option B

Monorepo implementing JWT auth, MongoDB-backed expenses/categories, basic reporting, and an **optional OpenAI-powered category suggestion** endpoint (server-side, with graceful degradation).

## Architecture overview

- **`apps/web`**: React 18 + TypeScript + Vite + Tailwind CSS. React Router for navigation, TanStack Query for server state, Zustand (persist) for the session token, React Hook Form + Zod for validation. Recharts renders category totals.
- **`apps/api`**: A single AWS Lambda function (HTTP API catch-all) running **Hono** on Node.js 20. **Mongoose** connects to **MongoDB Atlas**. Auth uses **bcrypt** password hashes and **JWT** access tokens (7-day expiry).
- **`packages/shared`**: Zod request schemas, default category names, and a small **sanitize** helper used by API and validated consistently on the client via the same Zod schemas.

### AI Option B (category suggestion)

- Endpoint: `POST /ai/suggest-category`
- The model receives **only** the user’s category list plus the current expense fields (description/amount/date). It returns JSON (`categoryId`, `confidence`, `rationale`).
- If `OPENAI_API_KEY` is missing, the API returns `available: false` with a clear message (no hard failure).
- The UI shows loading/disabled states and inline guidance when AI is disabled, uncertain, or errors.

### Prompt / cost / latency choices (high level)

- Model: **`gpt-4o-mini`** (cheap + fast enough for classification-style JSON).
- Temperature **0.2** for stability.
- **12s** client-side timeout on the OpenAI HTTP request (Lambda remains within API Gateway limits).
- The UI only calls AI **on demand** (button), not on every keystroke.

## Prerequisites

- **Node.js 20+**
- **pnpm 9** (repo pins `packageManager` in root `package.json`)
- **MongoDB Atlas** cluster + connection string
- **AWS account** (for deploy) + AWS credentials configured locally (`aws configure`)
- Optional: **OpenAI API key** for AI suggestions

## Environment variables

There are **two** env files for local development:

1. **`apps/api/.env`** (API + Serverless offline)

   - Copy from `apps/api/.env.example`
   - Required: `MONGODB_URI`, `JWT_SECRET` (min 16 chars)
   - Optional: `OPENAI_API_KEY`, `CORS_ORIGIN`, `LOG_LEVEL`

2. **`apps/web/.env`** (Vite)

   - Copy from `apps/web/.env.example`
   - Required: `VITE_API_URL` (local default `http://localhost:3000` matches Serverless Offline below)

The repository root also includes a combined reference file: `.env.example`.

### Graceful configuration errors

If required API env vars are missing, non-health endpoints return **503** with a JSON body explaining the configuration problem. `/health` returns **503** with the same details if misconfigured, or **503** if MongoDB cannot be reached.

## Local setup (one-command style)

```bash
pnpm install
```

Create the two env files described above, then:

```bash
pnpm run build
pnpm run dev
```

`pnpm run dev` runs:

- Web: `http://localhost:5173`
- API (Serverless Offline): `http://localhost:3000`

### Required checks (from the brief)

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

`pnpm run typecheck` typechecks `packages/shared`, then **builds** `@extropy/shared` (so `dist/` and `.d.ts` exist), then typechecks `apps/api` and `apps/web` against the compiled shared package.

### If `pnpm install` fails with `ERR_PNPM_EBUSY` (Windows)

That usually means something is **locking files** in the pnpm store (common when the global store lives on **`G:\`** synced/network/remapped drives, or when antivirus holds temp files).

This repo’s **`.npmrc`** sets **`store-dir=C:/pnpm-store`** so installs use a folder on **`C:`** instead of `G:\.pnpm-store`. Create that folder if pnpm does not create it automatically, then:

1. Close other terminals / `pnpm` processes that might be using the store.
2. Delete the repo **`node_modules`** folder, then run **`pnpm install`** again.
3. If it still fails, add **`C:\pnpm-store`** (and your project path) to antivirus **exclusions** for a few minutes while installing.

**Linux / macOS:** remove the `store-dir=...` line from `.npmrc` (or change it to a path on your machine), or run `pnpm config set store-dir ~/.local/share/pnpm/store` once for your user.

### If `pnpm run typecheck` fails with “cannot find module” for `typescript` / `tsc`

`pnpm install` must **complete successfully** first. The root `typecheck` script runs `node ./node_modules/typescript/lib/tsc.js` with each package’s `tsconfig.json` (works on Windows without relying on `.cmd` shims).

## Deploy (AWS, Serverless Framework)

From `apps/api` (with `apps/api/.env` populated, or env vars exported in your shell):

```bash
pnpm --filter @extropy/api deploy
```

After deploy, Serverless prints an **HTTP API** base URL. Set:

- `apps/web/.env` → `VITE_API_URL` to that base URL (no trailing slash)
- Rebuild/deploy the static frontend (see “Frontend hosting” below)

### Frontend hosting (recommended path)

The API stack deploys the Lambda + HTTP API. The Vite app is static assets; host on **S3 + CloudFront**, **Amplify Hosting**, or similar. The UI must be built with the production `VITE_API_URL`.

Build the web app:

```bash
pnpm --filter @extropy/web build
```

Artifacts are in `apps/web/dist/`.

### CORS

`CORS_ORIGIN` controls API Gateway HTTP API CORS `allowedOrigins`. For local dev, `*` is fine. For production, set it to your deployed web origin (example: `https://your-app.example.com`).

## Submission checklist (Extropy brief)

Before you submit, fill these in at the top of your fork’s **README** (or in the PR body):

| Deliverable | Your value |
|-------------|------------|
| **GitHub repository (public)** | `https://github.com/<you>/<repo>` |
| **Live frontend URL** | `https://…` (built with production `VITE_API_URL`) |
| **Live API base URL** | `https://…execute-api…amazonaws.com` (from `serverless deploy` output) |

Confirm locally:

- `pnpm run typecheck` — passes  
- `pnpm run lint` — passes  
- `pnpm test` — passes  
- `pnpm run build` — passes  
- `pnpm run dev` — register, add expense, filters, reports, AI suggest (with or without `OPENAI_API_KEY`), sign out  
- Deployed stack: health check `GET {API}/health` returns `{ "ok": true }` when MongoDB is reachable  

## Troubleshooting

- **`Missing VITE_API_URL` in the browser console**: create `apps/web/.env` from `apps/web/.env.example`.
- **API returns `configuration_error`**: verify `apps/api/.env` exists and includes `MONGODB_URI` + `JWT_SECRET`.
- **Mongo “bad auth”**: confirm Atlas database user/password and IP allowlist (allow `0.0.0.0/0` temporarily for Lambda if needed).
- **Serverless Offline not starting**: ensure port `3000` is free; override `custom.serverless-offline.httpPort` in `apps/api/serverless.yml` if needed and update `VITE_API_URL` accordingly.
- **Git hooks after clone**: run `git config core.hooksPath .githooks` once so the bundled hooks stay enabled (they strip stray automated `Co-authored-by` trailers when present).

## Security notes (what we implemented)

- Passwords hashed with bcrypt.
- JWT access tokens for API authorization; all expense/category/report routes are scoped by `userId` from the token.
- Basic **HTML escaping** sanitization for user-provided text fields on the API.
- Structured **JSON logs** to CloudWatch via `console.log(JSON.stringify(...))`.

## License

Private submission for Extropy.
