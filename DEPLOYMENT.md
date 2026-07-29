# ReplyFox — Deployment Guide

This is the step-by-step runbook for taking ReplyFox from this repo to a live,
production SaaS. Everything below runs on free tiers (per SPEC §11 / §20).

ReplyFox has **three deployable pieces**:

| Piece | What it is | Where it runs |
|---|---|---|
| **API** | Node `http` server (`src/server.js`) — all `/api/*` routes + serves `/widget.js` | Any Node host: **Render**, Railway, Fly.io, or a VPS |
| **Frontend (static)** | Landing + Business Dashboard + Ops Dashboard (plain HTML/CSS/JS) | **Vercel**, Cloudflare Pages, Netlify, or GitHub Pages |
| **Widget** | `widget.js` — served by the API at `/widget.js` (same origin as the API) | Bundled with the API |

> Why not Vercel for the API? `src/server.js` is a long-lived Node `http`
> server (a single process with in-memory rate limiters). Vercel serverless
> functions are request-scoped and won't preserve that state. Deploy the API to
> Render/Railway/Fly (free tiers) and the static frontend to Vercel. The
> handler files in `src/api/*.js` are pure `(req) => {status, body}` functions,
> so they can be wrapped in a Vercel adapter later if you prefer — but the
> simplest path is one Node process.

---

## 0. Prerequisites

- A GitHub account (the repo lives at `https://github.com/ghlsalama/replyfox`).
- Node 18+ installed locally to run the test suite.
- Accounts (all free): **Supabase**, **Groq**, **Stripe**, **Render** (or Railway/Fly), **Vercel**.

---

## 1. Database — Supabase

1. Sign up / log in at **https://supabase.com** and create a new project.
   - Pick a strong database password (save it).
   - Region: closest to your customers.
2. Open the **SQL Editor** → New query → paste the entire contents of
   [`src/schema.sql`](src/schema.sql) → **Run**.
   - This creates the 6 tables (`businesses`, `knowledge_base`, `widget_config`,
     `conversations`, `messages`, `usage_log`), indexes, the `touch_updated_at`
     trigger, the `get_or_create_conversation` helper, and enables RLS
     (SPEC §6).
3. Collect credentials from **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` **(keep secret — this is
     what the backend uses to bypass RLS for writes).**

> RLS note: the backend connects with the **service-role** key, which bypasses
> RLS and centralizes authz in the application layer (see comment at the bottom
> of `schema.sql`). If you later want the browser to read directly, add explicit
> `create policy` statements as shown there.

---

## 2. LLM — Groq

1. Sign up at **https://console.groq.com** → **API Keys** → Create key.
2. Copy it → `GROQ_API_KEY`.
3. Defaults are already correct (no change needed): model
   `llama-3.3-70b-versatile`, temperature `0.3`, max tokens `300`, top-p `0.9`
   (SPEC §7.2). Override with `GROQ_MODEL` / `GROQ_BASE_URL` only if you must.

---

## 3. Payments — Stripe

1. Sign up at **https://stripe.com** and activate test mode
   (`https://dashboard.stripe.com/test/apikeys`).
2. Create the two recurring products/prices (SPEC §8.1):
   - **Pro** — $29.00 / month
   - **Business** — $99.00 / month
   - Copy each `price_…` id.
3. Collect from the Stripe dashboard:
   - `Secret key` (`sk_test_…`) → `STRIPE_SECRET_KEY`
   - The Pro price id → `STRIPE_PRO_PRICE_ID`
   - The Business price id → `STRIPE_BUSINESS_PRICE_ID`
4. **Webhook** (after the API is deployed — step 4):
   - Stripe Dashboard → Developers → **Webhooks** → Add endpoint.
   - Endpoint URL: `https://<YOUR_API_DOMAIN>/api/billing/webhook`.
   - Events to send: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`.
   - After creating, click the endpoint → **Signing secret** →
     `whsec_…` → `STRIPE_WEBHOOK_SECRET`.

> The webhook handler (`src/api/billing.js`) verifies the Stripe signature
> itself using Node's `crypto` (no Stripe SDK dependency) and resolves the plan
> from object metadata, the configured price ids, or defaults to `free`
> (SPEC §5.4 / §8.3).
>
> **Note on checkout creation:** the spec lists only the webhook as a backend
> endpoint. To actually *start* a Pro/Business checkout from the dashboard you
> need a small "create checkout session" endpoint (not yet implemented).
> Recommended next step: add `POST /api/billing/checkout` that builds a
> `stripe.checkout.Session` with `mode: 'subscription'`, the right `price`,
> `success_url` / `cancel_url`, and `metadata.business_key` (the webhook uses
> this to map back to the business). Until that exists, upgrades are simulated
> in the dashboard UI.

---

## 4. Deploy the API (Render — recommended free tier)

1. Push the repo to GitHub (already at `ghlsalama/replyfox`).
2. On **https://render.com** → New → **Web Service** → connect the repo.
3. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Plan:** Free (or Starter for no-sleep)
4. **Environment variables** (paste the values collected above):

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `SUPABASE_ANON_KEY` | *(anon key)* |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(service-role key)* |
   | `GROQ_API_KEY` | *(groq key)* |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_PRO_PRICE_ID` | `price_…` |
   | `STRIPE_BUSINESS_PRICE_ID` | `price_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
   | `PUBLIC_BASE_URL` | `https://your-api.onrender.com` *(the Render URL — used to build the embed `src`)* |
   | `NODE_ENV` | `production` |

5. Deploy. Confirm `https://your-api.onrender.com/healthz` returns
   `{"ok":true,"service":"replyfox",...}` and `/widget.js` returns the JS
   payload.
6. **Now** finish Stripe webhook setup (step 3.4) pointing at this URL.

> Railway / Fly.io / a $5 VPS work identically — anything that runs
> `node src/server.js` and exposes a port. `PORT` is read from the environment
> automatically.

---

## 5. Deploy the Frontend (Vercel — static)

The three static apps live under `src/landing/`, `src/dashboard/`, and
`dashboard/`. They reference each other with relative paths
(`../dashboard/index.html`, etc.), so deploy the whole repo as a static site
rooted at the repo directory.

1. On **https://vercel.com** → New Project → import the GitHub repo.
2. Framework preset: **Other**. Build/Output: leave empty (static).
   - Root Directory: the repo root.
3. (Optional) Add a clean rewrite via a `vercel.json` at the repo root so
   `/` serves the landing page and `/dashboard` serves the dashboard. Minimal
   example:
   ```json
   {
     "cleanUrls": true,
     "rewrites": [
       { "source": "/",           "destination": "/src/landing/index.html" },
       { "source": "/dashboard",  "destination": "/src/dashboard/index.html" },
       { "source": "/ops",        "destination": "/dashboard/index.html" }
     ]
   }
   ```
4. Deploy. The landing page will be live at your Vercel domain.

> **Heads-up on wiring:** the dashboard (`src/dashboard/app.js`) currently uses
> mock/demo data and simulated training + checkout (per REVIEW.md). It does
> **not** yet call `/api/signup`, `/api/train`, or `/api/usage`. To make the
> dashboard fully live, wire those `fetch` calls to the API domain (use a
> `VITE_API_BASE` / config constant). Until then, the **widget + API are
> production-ready end-to-end** (you can sign up via `POST /api/signup`, train
> via `POST /api/train`, embed the returned `<script>`, and chat works), but
> the dashboard is a high-fidelity demo. See "Manual setup required" below.

---

## 6. End-to-End Smoke Test (after both are deployed)

Replace `$API` with your Render URL and `$KEY` with a real business key.

```bash
# 1. Create a business
curl -X POST $API/api/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret","businessName":"ACME"}'
# → { "businessKey":"<uuid>", "token":"<uuid>", "embedCode":"<script ...>" }

# 2. Train on some text
curl -X POST $API/api/train \
  -H 'Content-Type: application/json' \
  -d '{"businessKey":"<KEY>","source":"text","content":"We ship worldwide. Returns within 30 days. Open Mon–Fri 9–17."}'

# 3. Widget config (what widget.js fetches on load)
curl "$API/api/widget-config?key=<KEY>"

# 4. Chat
curl -X POST $API/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"businessKey":"<KEY>","message":"Do you ship internationally?","sessionId":"s1"}'
# → { "reply":"...", "emailRequest":false, ... }

# 5. Usage / analytics
curl "$API/api/usage?key=<KEY>"
```

Then drop the embed snippet on any HTML page and confirm the bubble appears:

```html
<script src="https://your-api.onrender.com/widget.js" data-key="<KEY>"></script>
```

---

## 7. Go-Live Checklist

- [ ] `schema.sql` run on Supabase; all 6 tables exist.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set on the API (not just anon).
- [ ] `GROQ_API_KEY` set; `/api/chat` returns a real reply.
- [ ] Stripe prices created; `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` set.
- [ ] Stripe webhook registered at `https://<api>/api/billing/webhook`; signing
      secret in `STRIPE_WEBHOOK_SECRET`; webhook test event returns 200.
- [ ] `PUBLIC_BASE_URL` set to the live API origin (so the generated embed code
      is correct).
- [ ] `/healthz` returns 200 on the deployed API.
- [ ] `/widget.js` returns the JS bundle (< 30 KB).
- [ ] Frontend deployed; landing page loads.
- [ ] End-to-end smoke test (section 6) passes.
- [ ] Embed snippet tested on at least one real customer site.

## 8. Manual setup still required (gaps vs full production)

1. **Wire the dashboard to the API.** `src/dashboard/app.js` is demo-only.
   Replace the mock data + simulated flows with real `fetch` calls to
   `/api/signup`, `/api/train`, `/api/usage`, `/api/widget-config`. The backend
   endpoints are ready and return the shapes the dashboard expects.
2. **Add a checkout-creation endpoint** (`POST /api/billing/checkout`) that
   returns a Stripe Checkout URL — see the note in section 3.
3. **Real auth.** Today the signup `token` equals the `business_key`. For
   production, wire Supabase Auth and return its JWT; have `/api/usage` verify
   the JWT instead of treating the key as the credential (the code is
   structured for this — see the "MVP auth note" comments in
   `src/api/signup.js` and `src/api/usage.js`).
4. **Embed-code origin.** The dashboard hardcodes `https://cdn.replyfox.io/...`
   in its demo embed code; once wired to the API, use the server-returned
   `embedCode` (which correctly uses `PUBLIC_BASE_URL`).

---

## 9. Local Development

```bash
npm install
cp .env.example .env       # fill in real values
npm run dev                # node --watch src/server.js  (http://localhost:3000)
npm test                   # 16 hermetic unit tests, no network
```

Open `src/landing/index.html` and `src/dashboard/index.html` directly in a
browser, or serve the repo root with any static server (`npx serve .`).
