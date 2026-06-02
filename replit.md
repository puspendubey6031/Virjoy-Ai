# VirJoy AI

A prompt-first cinematic AI video generation SaaS platform. Users type a prompt, optionally upload images/clips/screenshots, and the system generates cinematic MP4 videos. Plan-based feature control with a credit system and Supabase email/password authentication (with password reset and email change).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — Gemini AI (auto-provisioned via Replit AI Integrations)
- Optional env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase (server: verifies access tokens)
- Optional env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase (frontend auth client)
- Optional env: `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — Razorpay (payments)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (`artifacts/virjoy-ai/`)
- API: Express 5 (`artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM
- Auth: Supabase Auth (email/password, password reset, email change)
- Payments: Razorpay (₹199/₹399/₹799 subscription plans)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- File uploads: Multer
- Video processing: FFmpeg (via spawn)
- AI: Gemini 2.5 Flash via Replit AI Integrations (`lib/integrations-gemini-ai/`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/videoJobs.ts` — DB schema for video jobs
- `lib/db/src/schema/users.ts` — Users table (supabase_uid, credits, plan, mobile_verified)
- `lib/db/src/schema/subscriptions.ts` — Subscription billing records
- `lib/db/src/schema/creditLogs.ts` — Credit transaction history
- `artifacts/api-server/src/config/plans.ts` — plan config (all limits + credits controlled here)
- `artifacts/api-server/src/services/supabase.ts` — Supabase client + access-token verification
- `artifacts/virjoy-ai/src/lib/supabase.ts` — frontend Supabase client (session persistence)
- `artifacts/virjoy-ai/src/contexts/AuthContext.tsx` — auth state, sign in/up/out, password reset, email change
- `artifacts/api-server/src/services/credits.ts` — Credit cost calculation, deduct, add, refund
- `artifacts/api-server/src/services/razorpay.ts` — Razorpay client + signature verification
- `artifacts/api-server/src/middleware/auth.ts` — requireAuth, optionalAuth
- `artifacts/api-server/src/routes/auth.ts` — register, me, claim-free-credits
- `artifacts/api-server/src/routes/users.ts` — user profile, credit balance, generation history
- `artifacts/api-server/src/routes/payments.ts` — order creation, payment verify, webhook, history
- `artifacts/api-server/src/routes/videos.ts` — video CRUD + file upload (credit-aware)
- `artifacts/api-server/src/routes/plans.ts` — plan listing
- `artifacts/api-server/src/routes/aiStory.ts` — premium AI story generation (credit-aware)
- `artifacts/api-server/src/lib/videoProcessor.ts` — FFmpeg video processing
- `artifacts/virjoy-ai/src/pages/studio.tsx` — main creation page
- `artifacts/virjoy-ai/src/pages/history.tsx` — job history page

## Architecture decisions

- All plan limits are config-driven in `plans.ts` — no hardcoded restrictions in route handlers
- Video generation is async (queued → processing → done) — job is created immediately, processing runs via `setImmediate` after response
- **Credits are deducted ONLY after confirmed successful generation** — no charge on failure
- Auth is optional for video generation (`optionalAuth`) — existing guest usage still works; credit checking only applies to logged-in users
- Supabase Auth handles email/password sign-in; the server verifies the Supabase access token and upserts a local user row on register
- The frontend Supabase client persists sessions (localStorage, auto token refresh); `onAuthStateChange` keeps `AuthContext` and the backend user row in sync
- `pnpm-workspace.yaml` has `drizzle-orm: "0.45.2"` override to force a single drizzle-orm instance (transitive `@opentelemetry/api` peers can otherwise create a duplicate)
- FFmpeg is spawned as a child process; if not available, a placeholder video is created
- `@google/genai` is removed from esbuild externals so it gets bundled (it's needed at runtime)
- All external services (Supabase, Razorpay) degrade gracefully when env vars are missing

## Product & Credit System

| Plan | Price | Credits/month | Max Duration | Watermark |
|------|-------|--------------|-------------|-----------|
| Free | Free | 5 (10-day validity, claimable monthly) | 30s | Yes |
| Starter | ₹199 | 50 | 60s | Yes |
| Creator | ₹399 | 150 | 120s | No |
| Premium | ₹799 | 400 | 180s + AI Story | No |

Feature flags per plan (config in `plans.ts`): `enhancedCinematicEffects` & `priorityRendering` (Creator + Premium), `ideaToVideo` / AI Story (Premium only).

**Credit costs:** 10s=2, 30s=6, 60s=12, 180s=30 | +2/clip | +3 creator/premium cinematic effects | +5 AI story | Images free

## Auth Flow (Supabase)

1. Frontend signs up / signs in with email + password via the Supabase JS client
2. Supabase issues an access token; the client persists the session (localStorage + auto refresh)
3. `onAuthStateChange` fires → `AuthContext` calls `POST /api/auth/register` with the access token
4. Backend verifies the token with Supabase, upserts the local user row keyed by `supabase_uid`
5. Backend grants 5 free credits on first registration
6. Protected routes require a valid Supabase access token (`requireAuth`)
7. Password reset (`resetPasswordForEmail` → `/reset-password` page) and email change (`updateUser` on the `/account` page) are handled entirely client-side via Supabase

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen`
- After any DB schema change: run `pnpm --filter @workspace/db run push`
- `@google/genai` must NOT be in the esbuild external list in `build.mjs` — it needs to be bundled
- Video processing requires ffmpeg binary on PATH; falls back to placeholder if unavailable
- `pnpm-workspace.yaml` must keep `drizzle-orm: "0.45.2"` in overrides — removing it can break TypeScript due to a transitive `@opentelemetry/api` peer creating a duplicate drizzle-orm install
- Supabase/Razorpay fail gracefully when env vars not set — server starts and serves 503 for auth-dependent routes
- Supabase password reset / email change need redirect URLs and SMTP configured in the Supabase dashboard; the reset link points to `<origin><BASE_URL>reset-password`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.env.example` at the repo root for all required environment variable names
