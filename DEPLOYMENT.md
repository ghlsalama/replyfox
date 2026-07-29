# ReplyFox — Deployment Guide

## Quick Demo (30 seconds, zero credentials)

```bash
cd /Users/ghali/money-fleet/replyfox
npm install
npm run demo          # starts server on port 3000
```

Then open: **http://localhost:3000/demo**

You'll see a mock bakery website with the ReplyFox chatbot live in the corner. Try asking it:
- "What are your hours?"
- "How much is a croissant?"
- "Do you deliver?"
- "Where are you located?"

The bot answers from the knowledge base. When it can't answer, it captures the visitor's email.

---

## Production Deployment (4 steps, ~30 minutes)

### Step 1: Supabase (database + auth) — 5 minutes

1. Go to **supabase.com** → **New Project** (free tier)
2. Name it "replyfox", pick a region, set a database password
3. Wait for provisioning (~2 min)
4. Go to **SQL Editor** → paste the contents of `src/schema.sql` → **Run**
5. Go to **Settings → API**:
   - Copy **Project URL** (looks like `https://xxxxx.supabase.co`)
   - Copy **anon public key** (long string starting with `eyJ...`)
   - Copy **service_role key** (keep secret — used for server-side writes)

### Step 2: Groq (LLM) — 2 minutes

You already have a Groq API key from the First Light blog setup. Reuse it:
- Go to **console.groq.com** → API Keys → copy your key
- If you need a new one: **Create API Key** → copy

### Step 3: Stripe (payments) — 10 minutes

1. Go to **dashboard.stripe.com** → **Products** → **Add Product**
2. Name: "ReplyFox Pro" → Description: "Unlimited AI chatbot messages + analytics"
3. **Pricing:** Recurring → $29.00/month
4. Save → copy the **Price ID** (starts with `price_...`)
5. Go to **Developers → Webhooks** → **Add Endpoint**
   - URL: `https://YOUR-DOMAIN/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing Secret** (starts with `whsec_...`)

### Step 4: Deploy — 10 minutes

#### Option A: Render (easiest, free tier)

1. Go to **render.com** → **New → Web Service**
2. Connect your GitHub repo: `ghlsalama/replyfox`
3. Settings:
   - Build: `npm install`
   - Start: `npm start`
   - Environment variables (add ALL):
     ```
     SUPABASE_URL=https://xxxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
     SUPABASE_ANON_KEY=eyJhbGci...
     GROQ_API_KEY=gsk_...
     STRIPE_SECRET_KEY=sk_live_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     STRIPE_PRO_PRICE_ID=price_...
     ```
4. Deploy → wait for build → live!

#### Option B: Vercel (frontend) + Render (API)

- Deploy `src/landing/` and `src/dashboard/` to Vercel as static sites
- Deploy `src/server.js` to Render as a web service
- Update the widget's API base URL to point to the Render URL

#### Option C: Local / VPS

```bash
export SUPABASE_URL=https://xxxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
export SUPABASE_ANON_KEY=eyJhbGci...
export GROQ_API_KEY=gsk_...
export STRIPE_SECRET_KEY=sk_live_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export STRIPE_PRO_PRICE_ID=price_...
npm install && npm start
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Prod only | Database URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod only | Server-side DB writes |
| `SUPABASE_ANON_KEY` | Prod only | Client-side DB access |
| `GROQ_API_KEY` | Prod only | LLM for chat responses |
| `STRIPE_SECRET_KEY` | Prod only | Process payments |
| `STRIPE_WEBHOOK_SECRET` | Prod only | Verify payment webhooks |
| `STRIPE_PRO_PRICE_ID` | Prod only | Pro plan price reference |
| `PORT` | No | Server port (default: 3000) |

**If none are set:** ReplyFox runs in **DEMO MODE** (mock data) — perfect for testing.

---

## Post-Deploy Checklist

- [ ] Health check returns OK at your URL
- [ ] `/demo` page loads with working chatbot
- [ ] Sign up a test business → train → get embed code
- [ ] Embed widget on a test page → chat works cross-origin
- [ ] Stripe test checkout works (card: 4242 4242 4242 4242)
- [ ] Free-tier limit enforced (50 messages → upgrade prompt)
- [ ] Stripe webhook endpoint configured
- [ ] Product Hunt launch (use PRODUCTHUNT.md)
- [ ] Cold outreach started (use OUTREACH.md)

---

## Troubleshooting

**Widget doesn't load:** Check script URL, browser console for CORS, data-key matches a business.

**Chatbot silent:** Check GROQ_API_KEY set, business exists in DB, knowledge base has content.

**Stripe webhook fails:** Check STRIPE_WEBHOOK_SECRET, URL is public (not localhost), Stripe dashboard logs.

**DB connection:** Check SUPABASE_URL format, service_role key (not anon), schema.sql executed.
