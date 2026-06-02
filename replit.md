# VirJoy AI

A prompt-first cinematic AI video generation SaaS platform. Users type a prompt, optionally upload images/clips/screenshots, and the system generates cinematic MP4 videos. Plan-based feature control with a credit system and dual authentication (Firebase email + mobile OTP).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — Gemini AI (auto-provisioned via Replit AI Integrations)
- Optional env: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` — Firebase Admin (auth)
- Optional env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase (real-time features)
- Optional env: `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — Razorpay (payments)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (`artifacts/virjoy-ai/`)
- API: Express 5 (`artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM
- Auth: Firebase Admin SDK (email + phone OTP, dual verification)
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
- `lib/db/src/schema/users.ts` — Users table (firebase_uid, credits, plan, mobile_verified)
- `lib/db/src/schema/subscriptions.ts` — Subscription billing records
- `lib/db/src/schema/creditLogs.ts` — Credit transaction history
- `artifacts/api-server/src/config/plans.ts` — plan config (all limits + credits controlled here)
- `artifacts/api-server/src/services/firebase.ts` — Firebase Admin SDK init + token verification
- `artifacts/api-server/src/services/supabase.ts` — Supabase client (optional real-time)
- `artifacts/api-server/src/services/credits.ts` — Credit cost calculation, deduct, add, refund
- `artifacts/api-server/src/services/razorpay.ts` — Razorpay client + signature verification
- `artifacts/api-server/src/middleware/auth.ts` — requireAuth, requireMobileVerified, optionalAuth
- `artifacts/api-server/src/routes/auth.ts` — register, verify-mobile, me, claim-free-credits
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
- Firebase handles both email/password and phone OTP auth; backend checks `phone_number` field in decoded token to confirm mobile verification
- `pnpm-workspace.yaml` has `drizzle-orm: "0.45.2"` override to prevent dual-instance conflict with firebase-admin's `@opentelemetry/api` peer
- FFmpeg is spawned as a child process; if not available, a placeholder video is created
- `@google/genai` is removed from esbuild externals so it gets bundled (it's needed at runtime)
- All external services (Firebase, Razorpay, Supabase) degrade gracefully when env vars are missing

## Product & Credit System

| Plan | Price | Credits/month | Max Duration | Watermark |
|------|-------|--------------|-------------|-----------|
| Free | Free | 5 (10-day validity, claimable monthly) | 30s | Yes |
| Starter | ₹199 | 50 | 60s | Yes |
| Creator | ₹399 | 150 | 120s | No |
| Premium | ₹799 | 400 | 180s + AI Story | No |

Feature flags per plan (config in `plans.ts`): `enhancedCinematicEffects` & `priorityRendering` (Creator + Premium), `ideaToVideo` / AI Story (Premium only).

**Credit costs:** 10s=2, 30s=6, 60s=12, 180s=30 | +2/clip | +3 creator/premium cinematic effects | +5 AI story | Images free

## Auth Flow (Dual Verification)

1. Frontend creates Firebase account with email + password
2. Frontend sends OTP to phone via Firebase phone auth
3. User enters OTP → Firebase verifies → token gains `phone_number` field
4. Frontend calls `POST /api/auth/register` with Firebase ID token
5. Backend decodes token → sees `phone_number` → marks `mobile_verified = true`
6. Backend grants 5 free credits on first registration
7. All protected routes require both email auth AND mobile verification

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen`
- After any DB schema change: run `pnpm --filter @workspace/db run push`
- `@google/genai` must NOT be in the esbuild external list in `build.mjs` — it needs to be bundled
- Video processing requires ffmpeg binary on PATH; falls back to placeholder if unavailable
- `pnpm-workspace.yaml` must keep `drizzle-orm: "0.45.2"` in overrides — removing it breaks TypeScript due to firebase-admin's @opentelemetry/api peer creating a duplicate drizzle-orm install
- Firebase/Razorpay/Supabase all fail gracefully when env vars not set — server starts and serves 503 for auth-dependent routes

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.env.example` at the repo root for all required environment variable names
