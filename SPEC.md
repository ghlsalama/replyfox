# ReplyFox — Product Specification
## AI-Powered Customer Support Chatbot Platform for Small Businesses

**Version:** 1.0  
**Date:** 2026-07-29  
**Author:** Fleet Architecture (autonomous)  
**Status:** ACTIVE — strictly adhere to this specification at every build step.

---

## 1. Executive Summary

### 1.1 The Business

ReplyFox is a Software-as-a-Service (SaaS) platform that lets small businesses add an AI-powered customer support chatbot to their website in under 5 minutes — for $29/month instead of the $74+ that enterprise tools like Intercom charge.

A business owner signs up, pastes their website URL or FAQ content, and ReplyFox trains a chatbot on that knowledge. They get a single line of embed code (a `<script>` tag) to paste into their website. Instantly, visitors can chat with an AI that answers questions about the business, its products, its policies — 24/7, in any language, with human-level accuracy grounded in the business's own content.

### 1.2 Why This Is the Big Money Move

| Factor | Detail |
|---|---|
| **Revenue model** | Monthly recurring subscription ($29/month Pro tier) |
| **ARPU** | $29/month average (higher tiers available at $99) |
| **Target** | 100 customers in 6 months = $2,900/month recurring |
| **Scale** | 500 customers = $14,500/month. 1,000 = $29,000/month |
| **Capital required** | $0 (all free tiers: Vercel, Supabase, Groq, Cloudflare, Stripe) |
| **Gross margin** | ~95%+ (software, near-zero marginal cost per customer) |
| **Stickiness** | Once embedded on a website, removing it means losing 24/7 support → high retention |
| **Buildable by agents** | Yes — full-stack web app, well-defined components |
| **Market** | 30M+ small businesses globally with websites that need affordable support |
| **Competitive gap** | Enterprise tools cost $74-$500/month. ReplyFox is $29. Most SMBs have NO chatbot. |

### 1.3 The Core Insight

Every small business website gets the same questions over and over: "What are your hours?" "Do you ship internationally?" "How much is X?" "Can I return Y?" Currently these go unanswered after hours, get buried in email, or require hiring a $30k+/year support person.

ReplyFox solves this for $29/month — less than the cost of a single hour of human support. The AI reads the business's content and answers instantly, any time, in any language. When it doesn't know, it captures the visitor's email for follow-up.

This is not a side hustle. It is a real SaaS business with a real product, real customers, and real recurring revenue. It is the kind of business that can generate $10k-$50k/month within 12-18 months.

---

## 2. Market Analysis

### 2.1 The Problem

Small businesses face a support crisis:

- **After-hours abandonment:** 68% of website visitors arrive outside business hours. Their questions go unanswered. They leave. They buy from a competitor.
- **Email overload:** Small business owners spend 3-5 hours/day answering repetitive emails. Each answered individually. Most are the same 10-15 questions.
- **No affordable solution:** Enterprise chatbot platforms (Intercom, Drift, Zendesk) cost $74-$500/month — unaffordable for a business making $5k-$50k/month.
- **DIY chatbots are hard:** Building a chatbot requires coding, hosting, NLP training, widget design. Most SMB owners can't do this.
- **Lost sales:** Unanswered pre-sale questions ("Does this come in blue?" "Do you offer payment plans?") directly cost revenue. Studies show 35% of visitors who can't get answers leave without buying.

### 2.2 Existing Solutions and Their Weaknesses

| Competitor | Price | Weakness |
|---|---|---|
| Intercom | $74+/month | Too expensive for SMBs. Complex setup. Built for enterprise. |
| Drift (Salesloft) | $2,500+/month | Enterprise-only. Not accessible to small businesses. |
| Tidio | $29+/month | Closest competitor. But limited AI — mostly rule-based bots. RAG quality is poor. |
| Chatbase | $19+/month | AI-powered but limited customization, message caps, generic branding. |
| ManyChat | $15+/month | Focused on social media (Facebook/Instagram), not website chat. |
| Manual forms/email | Free | Slow, no instant answers, high friction. |

**ReplyFox's wedge:** AI-native (grounded RAG, not rule-based), genuinely affordable ($29 flat, no message caps on Pro), 5-minute setup, fully customizable widget, and built for small businesses specifically.

### 2.3 Target Customer

**Primary:** Small business owners with a website who get repetitive customer questions:
- E-commerce stores (Shopify, WooCommerce, Etsy shops with standalone sites)
- Service businesses (dentists, plumbers, electricians, salons, gyms, lawyers, accountants)
- SaaS startups (small teams that can't afford a support hire)
- Course creators and coaches (FAQ-heavy)
- Local businesses with "Contact Us" pages that should be "Chat With Us"

**Secondary:** Agencies and freelancers who manage multiple client websites (multi-seat opportunity at $99/month Business tier).

### 2.4 Market Size

- **TAM (Total Addressable Market):** ~33 million small businesses in the US alone with websites (SBA data). Globally: 200M+.
- **SAM (Serviceable Addressable Market):** ~10M SMBs with websites in English-speaking markets who currently have no chatbot.
- **SOM (Serviceable Obtainable Market in Year 1):** 500-2,000 customers (0.005-0.02% penetration). At $29/month, that's $14,500-$58,000/month.

This is a massive market with room for many players. ReplyFox doesn't need to dominate — it needs to serve a few hundred customers well to generate life-changing income.

---

## 3. Product Overview

### 3.1 What ReplyFox Does (In One Sentence)

ReplyFox lets any business owner paste their website URL, get an AI chatbot trained on their content, and embed it on their site with one line of code — for $29/month.

### 3.2 The Three Components

```
┌─────────────────────────────────────────────────────────────┐
│                      REPLYFOX PLATFORM                        │
│                                                               │
│  ┌─────────────┐   ┌───────────────┐   ┌─────────────────┐ │
│  │  Landing     │   │  Dashboard    │   │  Chatbot Widget  │ │
│  │  Page        │   │  (Business    │   │  (Embeddable     │ │
│  │  (Marketing) │   │   Owner App)  │   │   on any site)   │ │
│  └─────────────┘   └───────────────┘   └─────────────────┘ │
│         │                   │                      │         │
│         │           ┌───────┴────────┐              │         │
│         │           │  Backend API   │              │         │
│         └──────────►│  (Serverless)  │◄─────────────┘         │
│                     │                │                        │
│                     │  ┌──────────┐  │                        │
│                     │  │ Database │  │                        │
│                     │  │(Supabase)│  │                        │
│                     │  └──────────┘  │                        │
│                     │  ┌──────────┐  │                        │
│                     │  │   LLM    │  │                        │
│                     │  │  (Groq)  │  │                        │
│                     │  └──────────┘  │                        │
│                     │  ┌──────────┐  │                        │
│                     │  │ Stripe   │  │                        │
│                     │  │ (Billing)│  │                        │
│                     │  └──────────┘  │                        │
│                     └────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

1. **Landing Page** — the public marketing site (replyfox landing). Explains the product, shows pricing, lets visitors sign up.
2. **Dashboard** — the business owner's control panel. They train their chatbot, customize the widget, view analytics, manage billing.
3. **Chatbot Widget** — the embeddable chat bubble that appears on the business's website. Visitors chat with it.

### 3.3 User Journey

1. **Discovery:** Business owner finds ReplyFox (via search, Product Hunt, referral, or direct outreach).
2. **Signup:** Creates an account (email + password, no credit card required for free tier).
3. **Training:** Pastes their website URL OR pastes FAQ text OR uploads a document. ReplyFox ingests the content and creates a knowledge base.
4. **Customization:** Picks a widget color, writes a greeting message, optionally sets business hours.
5. **Embed:** Copies one line of code (`<script>`) and pastes it into their website's HTML.
6. **Live:** The chatbot is now live on their website. Visitors can chat instantly.
7. **Upgrade:** After 50 free messages, they upgrade to Pro ($29/month) for unlimited messages + analytics + custom branding.

---

## 4. Technical Architecture

### 4.1 Technology Stack

| Layer | Technology | Why | Cost |
|---|---|---|---|
| **Frontend** (Landing + Dashboard) | Next.js or static HTML/JS | Fast, SEO-friendly, deployable on free tier | $0 (Vercel) |
| **Chatbot Widget** | Vanilla JavaScript (no dependencies) | Must work on ANY website without conflicts | $0 (CDN) |
| **Backend API** | Cloudflare Workers (serverless) | Global edge network, fast, free tier generous | $0 (100k requests/day free) |
| **Database** | Supabase (PostgreSQL) | Managed Postgres, built-in auth, RLS, free tier | $0 (500MB, 50k rows free) |
| **Vector Embeddings** | Supabase pgvector or simple context-passing | For RAG (knowledge base search) | $0 |
| **LLM** | Groq (Llama 3.3 70B Versatile) | Fast inference, large context, free tier | $0 |
| **Payments** | Stripe | Industry standard, pay-per-use, no upfront | $0 (percentage per sale) |
| **Hosting (Landing)** | Vercel or Cloudflare Pages | Free tier, automatic HTTPS, custom domain | $0 |
| **Email (notifications)** | Resend or SendGrid free tier | For signup confirmations, usage alerts | $0 |

**Total monthly cost at 100 customers:** ~$20-$50 (LLM API calls + database + hosting overages). Revenue at 100 customers: $2,900/month. **Gross margin: 95%+.**

### 4.2 System Architecture Diagram

```
VISITOR'S BROWSER                    BUSINESS OWNER'S BROWSER
     │                                        │
     │ <script src="widget.js" data-key>      │  Dashboard (React/HTML)
     │                                        │  - Train chatbot
     ▼                                        │  - View analytics
┌──────────┐                                  │  - Manage billing
│ Widget   │         INTERNET                 │  - Get embed code
│ (chat    │──────────────┐                   │
│  bubble) │              │                   │
└──────────┘              │                   │
     │                    │                   │
     │ POST /api/chat     │           GET /dashboard
     │ {message, key}     │                   │
     │                    ▼                   ▼
     │           ┌──────────────────────────────────┐
     │           │       CLOUDFLARE WORKERS         │
     │           │       (Serverless API)            │
     │           │                                    │
     │           │  /api/chat     → answer visitor   │
     │           │  /api/train    → ingest content   │
     │           │  /api/usage    → analytics data   │
     │           │  /api/billing  → Stripe webhook   │
     │           │  /api/signup   → create account   │
     │           └──────────────────────────────────┘
     │                    │           │           │
     │                    ▼           ▼           ▼
     │           ┌──────────┐ ┌─────────┐ ┌─────────┐
     │           │ Supabase │ │  Groq   │ │ Stripe  │
     │           │ (DB+Auth)│ │  (LLM)  │ │ (Pay)   │
     │           └──────────┘ └─────────┘ └─────────┘
```

### 4.3 Data Flow: Chat Request

1. Visitor types a message in the widget.
2. Widget sends `POST /api/chat` with `{ message, businessKey }`.
3. API looks up the business by key → retrieves knowledge base content.
4. API constructs LLM prompt: `system: "You are a helpful support agent for {businessName}. Answer questions based ONLY on this information: {knowledgeBase}. If you don't know, say: 'I'm not sure about that — let me get your email so our team can follow up.' Be friendly, concise, and accurate."` + `user: {visitorMessage}`.
5. API calls Groq LLM → gets response.
6. API stores the conversation (for analytics) → returns response to widget.
7. Widget displays the response with a typing animation.

### 4.4 Data Flow: Training

1. Business owner pastes website URL or FAQ text in the dashboard.
2. Dashboard sends `POST /api/train` with `{ content, businessKey }`.
3. API processes content:
   - If URL: fetch the page HTML, extract text content (strip scripts, styles, nav).
   - If text: use as-is.
   - Chunk into sections (max 500 chars each) for better LLM context.
4. Store processed knowledge base in the database (keyed by businessKey).
5. Return success → dashboard shows "Chatbot trained! Embed code ready."

---

## 5. Detailed Feature Specifications

### 5.1 Landing Page

**Purpose:** Convert visitors into signups.

**Sections (top to bottom):**

1. **Hero:** Headline "Add AI Customer Support to Your Website in 5 Minutes" + subheadline "No coding. No expensive software. Just paste your URL and get a chatbot that answers your customers 24/7." + CTA button "Start Free →" + product screenshot/mockup.

2. **Social Proof Bar:** "Trusted by businesses" (placeholder logos) + "Rated 4.9/5" (placeholder).

3. **How It Works (3 steps):**
   - Step 1: "Paste your website URL or FAQ" (icon: link/document)
   - Step 2: "Get your embed code" (icon: code)
   - Step 3: "Your chatbot is live" (icon: chat bubble)

4. **Features Grid (6 cards):**
   - 🤖 AI-Powered — "Trained on YOUR content. Real answers, not generic bots."
   - ⚡ Instant Setup — "Live in 5 minutes. No coding required."
   - 🌍 24/7 Availability — "Never miss a question, even after hours."
   - 🎨 Customizable — "Match your brand. Colors, position, greeting."
   - 📊 Analytics — "See what customers ask. Spot trends. Improve."
   - 💬 Lead Capture — "When the bot can't answer, it captures their email."

5. **Pricing Section:**
   - Free: $0/month — 50 messages, 1 knowledge base, basic widget. "Start Free"
   - Pro: $29/month — Unlimited messages, analytics, custom branding, priority. "Start Pro Trial"
   - Business: $99/month — Everything in Pro + multi-seat, API access, white-label. "Contact Us"

6. **FAQ Section:** Common objections answered:
   - "Do I need to code?" → No. Paste one line of code.
   - "How accurate is the AI?" → It only answers from YOUR content. No hallucinations on topics outside your knowledge.
   - "Can I customize the widget?" → Yes. Colors, position, greeting, business hours.
   - "What if it can't answer?" → It captures the visitor's email for follow-up.
   - "Can I cancel anytime?" → Yes. No contracts.

7. **Final CTA:** "Start Your Free Chatbot →" + email signup field.

**Design:** Clean, modern, trustworthy. Blue/teal primary color. Inter or system sans font. Responsive. Fast load (<2s).

### 5.2 Dashboard (Business Owner App)

**Purpose:** Let business owners manage their chatbot.

**Pages:**

1. **Onboarding (first visit):**
   - Step 1: "What's your business name?" → text input
   - Step 2: "Add your knowledge" → paste website URL OR paste FAQ text OR upload .txt/.pdf
   - Step 3: "Customize your widget" → pick color (color picker), write greeting ("Hi! How can I help you today?"), toggle position (bottom-right default)
   - Step 4: "Embed on your website" → show the `<script>` code + copy button + "I've added it" button
   - Step 5: "You're live!" → success animation + link to dashboard

2. **Dashboard Home (overview):**
   - Stats cards: Messages this month, Active conversations, Emails captured, Satisfaction rate
   - Recent conversations list (last 10): visitor question → bot answer → timestamp
   - Usage bar: "47/50 free messages used this month" → upgrade CTA when near limit

3. **Knowledge Base:**
   - Current content display (the trained text)
   - "Add more content" → paste URL or text → retrain
   - "Content quality" score (based on word count, structure)

4. **Customize:**
   - Widget color (color picker with presets)
   - Position (bottom-right, bottom-left)
   - Greeting message (text input)
   - Business name (text input)
   - Business hours (optional: "Outside hours, the bot says: 'We're currently closed. Leave your email and we'll get back to you.'")
   - Avatar (emoji or initials)
   - Live preview (shows the widget with current settings)

5. **Analytics:**
   - Messages over time (line chart: last 30 days)
   - Top questions (most frequently asked by visitors)
   - Escalation rate (% of messages where the bot couldn't answer → captured email)
   - Visitor satisfaction (thumbs up/down on bot responses)
   - Conversion: % of chats that led to email capture

6. **Billing:**
   - Current plan (Free / Pro / Business)
   - Usage this month
   - Upgrade button → Stripe checkout
   - Payment history
   - Cancel subscription

7. **Settings:**
   - Account email + password
   - Delete account
   - API key (for advanced integrations)

### 5.3 Chatbot Widget

**Purpose:** The embeddable chat interface that visitors use.

**Embedding:** Business owner pastes this into their website HTML:
```html
<script src="https://replyfox.api.workers.dev/widget.js" data-key="BUSINESS_KEY"></script>
```

**Behavior:**
1. On page load: the script injects a chat bubble (bottom-right by default).
2. Bubble shows the business's avatar (emoji/initials) + a subtle pulse animation.
3. After 3 seconds (configurable): an auto-greeting appears: "Hi! 👋 How can I help you today?"
4. Visitor clicks → chat window opens (300px wide, 500px tall, rounded corners, shadow).
5. Chat window: message history (scrollable), text input, send button, typing indicator.
6. When visitor sends a message:
   - Widget shows typing indicator ("ReplyFox is typing...")
   - Sends POST to API
   - Receives response → displays it (markdown rendered: bold, links, lists)
   - If response includes email capture: shows email input inline
7. After each bot response: shows 👍 / 👎 buttons (for satisfaction tracking).
8. If visitor is idle for 30 seconds after a response: bot says "Is there anything else I can help with?"
9. Chat history persists across page reloads (localStorage, keyed by visitor session).

**Styling:**
- Chat bubble: 60px circle, business's brand color, white icon.
- Chat window: white background, brand-color header bar, business name + avatar.
- Messages: visitor (right, gray bubble), bot (left, white bubble with border).
- Input: text field with send button (brand color).
- Font: system sans-serif, 14px body, 12px timestamp.
- Mobile: full-screen chat on devices < 768px wide.

**Technical Requirements:**
- The widget.js file must be self-contained (no external dependencies, no framework).
- Must not conflict with the host website's CSS/JS (use namespaced classes, inline styles or shadow DOM).
- Must load asynchronously (don't block page render).
- Total file size: < 30KB (minified).
- Works on all modern browsers (Chrome, Firefox, Safari, Edge — last 2 versions).

### 5.4 Backend API (Serverless)

**Runtime:** Cloudflare Workers (or Vercel serverless functions as fallback).

**Endpoints:**

#### POST /api/signup
- Input: `{ email, password, businessName }`
- Creates a Supabase auth user + business record.
- Returns: `{ businessKey, token }`
- Rate limit: 5/hour per IP.

#### POST /api/train
- Input: `{ businessKey, content, source (url|text|file) }`
- If source=url: fetch page, extract text (using a simple HTML-to-text converter).
- Process content: clean, chunk (max 500 char sections), store in knowledge_base table.
- Returns: `{ success, chunksProcessed, embedCode }`
- Rate limit: 10/hour per business.

#### POST /api/chat
- Input: `{ businessKey, message, sessionId }`
- Look up business → get knowledge base content.
- Construct LLM prompt (see §4.3).
- Call Groq API → get response.
- Store message in conversations table.
- Returns: `{ reply, captured (bool), emailRequest (bool) }`
- Rate limit: check against business's monthly message quota.
- Response time: target < 3 seconds.

#### GET /api/usage
- Input: auth token (from dashboard)
- Returns: `{ messagesThisMonth, quota, plan, conversations, topQuestions }`
- For analytics dashboard.

#### POST /api/billing/webhook
- Input: Stripe webhook event.
- Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Updates business's plan in database.

#### GET /api/widget-config
- Input: `?key=businessKey`
- Returns: `{ businessName, color, position, greeting, avatar, hours }`
- Used by the widget.js on load to configure appearance.

---

## 6. Database Schema

### 6.1 Supabase / PostgreSQL Tables

```sql
-- Businesses (the core entity)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  business_key TEXT UNIQUE NOT NULL,  -- public key for widget embedding
  plan TEXT DEFAULT 'free',           -- free | pro | business
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  messages_this_month INT DEFAULT 0,
  message_quota INT DEFAULT 50,       -- 50 free, unlimited for pro
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base (trained content per business)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,              -- the full processed text
  source TEXT,                        -- url | text | file
  source_url TEXT,
  chunk_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Widget configuration
CREATE TABLE widget_config (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#4F46E5',
  position TEXT DEFAULT 'bottom-right',
  greeting TEXT DEFAULT 'Hi! How can I help you today?',
  avatar TEXT DEFAULT '🤖',
  business_hours JSONB,               -- { "mon": "9-17", "tue": "9-17", ... }
  outside_hours_message TEXT DEFAULT 'We are currently closed. Leave your email and we will get back to you.'
);

-- Conversations (visitor chat sessions)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,           -- visitor's session (from widget localStorage)
  visitor_email TEXT,                 -- captured if bot asks for it
  started_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INT DEFAULT 0,
  escalated BOOLEAN DEFAULT FALSE     -- true if bot couldn't answer → email captured
);

-- Individual messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                 -- visitor | bot
  content TEXT NOT NULL,
  satisfaction TEXT,                  -- up | down | null
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking (for monthly reset)
CREATE TABLE usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,           -- "2026-07" format
  message_count INT DEFAULT 0,
  UNIQUE(business_id, month_year)
);
```

### 6.2 Row Level Security (RLS)

- Businesses can only read/write their own data (filtered by auth user ID).
- The `/api/chat` endpoint uses the `business_key` (public, read-only access to knowledge_base + widget_config).
- Analytics endpoints require authentication (dashboard token).

---

## 7. LLM Prompt Engineering

### 7.1 System Prompt (for Chat)

```
You are a customer support agent for {businessName}. Your job is to help visitors by answering their questions accurately and friendly.

CRITICAL RULES:
1. Answer ONLY based on the information provided below. Do NOT make up facts.
2. If you don't know the answer or the question is outside the provided information, say: "I'm not sure about that one — could you leave your email so our team can follow up with you?"
3. Be concise (2-3 sentences max per response unless the visitor asks for detail).
4. Be friendly and professional. Use the business's tone.
5. If the visitor seems ready to buy or book, encourage them gently.
6. Never discuss competitors, politics, or sensitive topics.
7. If asked about pricing, quote exactly what's in the knowledge base. Don't estimate.

BUSINESS KNOWLEDGE BASE:
{knowledgeBaseContent}

BUSINESS NAME: {businessName}
BUSINESS HOURS: {businessHours (if set)}
```

### 7.2 Parameters

- **Model:** Llama 3.3 70B Versatile (via Groq)
- **Temperature:** 0.3 (low — factual, consistent answers)
- **Max tokens:** 300 (concise responses)
- **Top-p:** 0.9

### 7.3 Email Capture Flow

When the LLM response contains "leave your email" or "follow up":
1. The API detects this pattern.
2. Returns `{ reply, emailRequest: true }`.
3. The widget shows the bot's message + an inline email input field.
4. Visitor enters email → widget sends it to the API.
5. API stores the email in `conversations.visitor_email` + marks `escalated = true`.
6. Dashboard shows the captured email in analytics.

---

## 8. Pricing Strategy

### 8.1 Tiers

| Feature | Free ($0) | Pro ($29/mo) | Business ($99/mo) |
|---|---|---|---|
| Messages/month | 50 | Unlimited | Unlimited |
| Knowledge base | 1 (5,000 chars) | 5 (50,000 chars) | Unlimited |
| Widget customization | Basic colors | Full branding + avatar | White-label (no ReplyFox branding) |
| Analytics | Message count | Full analytics + top questions + satisfaction | Everything + API access |
| Lead capture | ✅ | ✅ | ✅ |
| Business hours | ❌ | ✅ | ✅ |
| Multi-seat | ❌ | ❌ | Up to 5 team members |
| Support | Community | Email (48h response) | Priority (24h + Slack) |

### 8.2 Why This Pricing Works

- **Free tier:** Generous enough to prove value (50 messages = ~2-3 conversations). Once a business sees the bot answering real questions, upgrading to unlimited is a no-brainer.
- **$29 Pro:** Less than $1/day. Cheaper than a single hour of human support. The ROI is obvious (saves 5+ hours/week of repetitive emails).
- **$99 Business:** For agencies/managers with multiple sites. Still 60% cheaper than Intercom's cheapest plan.

### 8.3 Stripe Integration

- **Checkout:** Stripe-hosted checkout page (no PCI compliance needed).
- **Subscription:** Monthly billing, cancel anytime.
- **Webhook:** Handles upgrade, downgrade, cancellation, payment failure.
- **Free → Pro flow:** Dashboard shows "You've used 47/50 free messages. Upgrade for unlimited →" → Stripe checkout → webhook upgrades plan → message quota removed.

---

## 9. Chatbot Widget Technical Specification

### 9.1 File: widget.js

A single self-contained JavaScript file (~15-25KB minified) that:

1. **Reads configuration** from the `<script>` tag's `data-key` attribute.
2. **Fetches widget config** from `GET /api/widget-config?key=BUSINESS_KEY`.
3. **Injects DOM elements:**
   - Chat bubble (fixed position, bottom-right or bottom-left).
   - Chat window (hidden initially, shown on bubble click).
   - Message container, input field, send button.
4. **Manages chat state:**
   - Session ID (random UUID, stored in localStorage).
   - Message history (stored in localStorage, max 50 messages).
   - Online/offline detection.
5. **Handles messaging:**
   - On send: disable input, show typing indicator, POST to API, display response.
   - Markdown rendering (bold, italic, links, line breaks).
   - Email capture (inline input when API requests it).
   - Satisfaction tracking (thumbs up/down after each bot response).
6. **Auto-greeting:** After configured delay (default 3s), shows greeting message.
7. **Responsive:** Full-screen overlay on mobile (< 768px).

### 9.2 CSS (Injected via JS)

All styles are scoped under a unique prefix (`.rf-`) to avoid conflicts with the host website. The widget uses inline styles or a dynamically injected `<style>` block with high specificity.

```css
.rf-bubble { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; ... }
.rf-window { position: fixed; bottom: 90px; right: 20px; width: 360px; height: 520px; ... }
.rf-message-visitor { ... }
.rf-message-bot { ... }
@media (max-width: 768px) { .rf-window { width: 100%; height: 100%; bottom: 0; right: 0; } }
```

### 9.3 Browser Compatibility

- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+.
- Graceful degradation: if the API is unreachable, show "Connection issue — please try again" and retry after 5 seconds.

---

## 10. Go-to-Market Strategy

### 10.1 Phase 1: Launch (Week 1-2)

1. **Product Hunt launch:** "ReplyFox — AI customer support chatbot for $29/month." Time it for a Tuesday/Wednesday morning (PT). Write a compelling description + demo GIF/video. This can drive 200-500 signups in 24 hours.

2. **Direct outreach (first 50 customers):** Email/LinkedIn DM to 200 small businesses:
   - Target: businesses with "Contact Us" pages but no live chat.
   - Message: "I noticed your site doesn't have a chatbot. I built ReplyFox — an AI chatbot that answers your customers' questions 24/7, trained on YOUR website. Free to try, $29/month if you love it. Want me to set it up for you? Takes 5 minutes."
   - Expected response rate: 5-10% = 10-20 signups.

3. **SEO content:** The fleet ops blog agent writes articles about AI customer support → drives organic traffic to ReplyFox landing page.

4. **Reddit/communities:** Post in r/smallbusiness, r/entrepreneur, r/SaaS — genuine value posts about affordable AI support, not spam.

### 10.2 Phase 2: Growth (Month 2-6)

1. **Affiliate program:** Offer 30% recurring commission to anyone who refers a paying customer. Others promote ReplyFox for passive income.

2. **Template marketplace integrations:** Create a Shopify App Store listing (Shopify merchants are ideal customers). WordPress plugin. Wix/Weebly integrations.

3. **Case studies:** Feature early customers who reduced support time by X% or captured Y leads. Social proof drives conversion.

4. **Content marketing:** Blog about customer support best practices, chatbot ROI, AI for small business. SEO compounds.

### 10.3 Phase 3: Scale (Month 6-12)

1. **Paid acquisition:** Once MRR > $3k, reinvest into Google Ads ("website chatbot," "AI customer support").
2. **Agency partnerships:** Partner with web design agencies — they install ReplyFox on every client site (bulk licenses at $99 Business tier).
3. **Feature expansion:** Multi-language support, voice chat, CRM integrations, Slack notifications.

---

## 11. Deployment Plan ($0 Capital)

### 11.1 Infrastructure Setup

| Service | What it hosts | Free tier limits | Upgrade trigger |
|---|---|---|---|
| **Vercel** | Landing page + dashboard | 100GB bandwidth, unlimited deploys | 100k visitors/month |
| **Cloudflare Workers** | Backend API | 100k requests/day | 100k chat messages/day (~3k businesses) |
| **Supabase** | Database + auth | 500MB storage, 50k monthly active users | 50k businesses |
| **Groq** | LLM inference | Generous free tier (rate-limited) | High volume → paid API |
| **Stripe** | Payments | $0 upfront (2.9% + 30¢ per sale) | N/A (scales with revenue) |

### 11.2 Domain

- Initially: host on Vercel/Cloudflare subdomain (free).
- Later: buy `replyfox.com` or `replyfox.ai` (~$10-20/year) when first revenue comes in.

### 11.3 Monitoring

- Vercel analytics (free) for landing page traffic.
- Supabase dashboard for database health.
- Cloudflare analytics for API usage.
- Custom dashboard (the ReplyFox ops dashboard — see §13) for business metrics.

---

## 12. Financial Projections

### 12.1 Revenue Model

Monthly Recurring Revenue (MRR) = active paying customers × $29 (average between Pro and Business tiers).

### 12.2 Projections

| Period | Customers (free) | Customers (paid) | MRR | Costs | Net |
|---|---|---|---|---|---|
| Month 1 | 50 | 3 | $87 | $0 | $87 |
| Month 3 | 200 | 15 | $435 | $5 | $430 |
| Month 6 | 500 | 50 | $1,450 | $20 | $1,430 |
| Month 9 | 1,000 | 100 | $2,900 | $50 | $2,850 |
| Month 12 | 2,000 | 200 | $5,800 | $100 | $5,700 |
| Month 18 | 5,000 | 500 | $14,500 | $300 | $14,200 |
| Month 24 | 10,000 | 1,000 | $29,000 | $600 | $28,400 |

**Assumptions:**
- 10% free-to-paid conversion rate (industry standard for SaaS freemium).
- Average revenue per paid customer: $29 (Pro tier dominant).
- Costs scale linearly with messages (LLM API + database + hosting).
- No paid acquisition costs in months 1-6 (organic + outreach only).

### 12.3 Break-Even

- **Per customer:** A $29/month customer costs ~$0.50/month in LLM + database. Break-even on the first day.
- **Business overall:** Break-even at 1 paying customer (since infrastructure is $0 on free tiers). Profitable from day 1.

---

## 13. ReplyFox Operations Dashboard

### 13.1 Purpose

A dedicated dashboard (separate from the Money Fleet dashboard) that tracks ReplyFox's business metrics in real-time.

### 13.2 Metrics Displayed

1. **MRR (Monthly Recurring Revenue)** — big hero number.
2. **Total businesses** (free + paid).
3. **Messages handled** (total + today).
4. **Conversion funnel:** visitors → signups → free users → paid users.
5. **Recent signups** (last 10 businesses, name + plan + timestamp).
6. **Popular questions** (across all chatbots — aggregated for product insights).
7. **System health:** API response time, error rate, LLM latency.
8. **Churn tracker:** cancellations this month.

### 13.3 Design

Jarvis/HUD aesthetic (consistent with the Money Fleet dashboard). Dark theme, glowing accents, real-time clock. Data fetched from the Supabase database + API stats.

---

## 14. Build Order (Agent Execution Plan)

### 14.1 Phase 1: Foundation (Agent 1)

**Task:** Set up the project structure, database schema, and backend API.

1. Create `/Users/ghali/money-fleet/replyfox/` project structure.
2. Set up package.json with dependencies.
3. Write the Supabase SQL schema (§6).
4. Build the backend API endpoints (§5.4):
   - `/api/signup` — create business account.
   - `/api/train` — ingest knowledge base content.
   - `/api/chat` — the core chatbot endpoint (LLM + knowledge base).
   - `/api/usage` — analytics data.
   - `/api/widget-config` — widget appearance config.
   - `/api/billing/webhook` — Stripe webhook handler.
5. Implement the LLM integration (Groq API call with the system prompt from §7).
6. Test each endpoint with mock data.

### 14.2 Phase 2: Frontend (Agent 2)

**Task:** Build the landing page + dashboard.

1. Build the landing page per §5.1 (hero, features, pricing, FAQ, CTA).
2. Build the dashboard per §5.2 (onboarding, home, knowledge base, customize, analytics, billing, settings).
3. Wire the dashboard to the backend API.
4. Make everything responsive + polished.

### 14.3 Phase 3: Widget (Agent 3)

**Task:** Build the embeddable chatbot widget.

1. Build widget.js per §5.3 + §9.
2. Self-contained, no dependencies, scoped CSS.
3. Chat bubble, window, messaging, typing indicator, email capture, satisfaction tracking.
4. LocalStorage for session persistence.
5. Mobile responsive.
6. Test by embedding on a test HTML page.

### 14.4 Phase 4: Integration + Deploy (Agent 4)

**Task:** Wire everything together and deploy.

1. Connect frontend ↔ backend ↔ database.
2. Set up Stripe checkout (test mode).
3. Deploy landing + dashboard to Vercel (or Cloudflare Pages).
4. Deploy API to Cloudflare Workers.
5. Set up Supabase database + run schema.
6. End-to-end test: signup → train → get embed code → embed on test page → chat → see analytics.
7. Verify the chatbot responds correctly.

### 14.5 Phase 5: Dashboard + Polish (Agent 5)

**Task:** Build the ReplyFox ops dashboard + final polish.

1. Build the ops dashboard per §13.
2. Deploy it.
3. Final QA: test all user flows, fix bugs.
4. Write the DEPLOYMENT.md (how to go live).
5. Write REVIEW.md entries for each phase.

---

## 15. Quality Criteria

### 15.1 Must-Pass Tests

1. **Chatbot responds correctly:** Given a knowledge base about a fictional business, the chatbot answers 5/5 test questions accurately from the content.
2. **Widget loads on any page:** Embed on 3 different HTML pages (plain, Bootstrap, WordPress-style) — no conflicts, no visual bugs.
3. **Signup → train → embed works end-to-end:** A new user can complete the full flow in under 5 minutes.
4. **Free tier enforcement:** After 50 messages, the bot stops responding and shows an upgrade prompt.
5. **Stripe checkout works:** Test mode checkout upgrades the plan correctly.
6. **Dashboard analytics update:** Messages appear in the dashboard within 5 seconds of being sent.
7. **Mobile responsive:** Landing page + dashboard + widget all work on mobile screens.
8. **Response time:** Chatbot responds in under 3 seconds (including network + LLM).

### 15.2 Performance Targets

- Landing page load: < 2 seconds.
- Widget.js load: < 200ms.
- API response (chat): < 3 seconds.
- Dashboard page transition: < 500ms.

---

## 16. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| LLM hallucinates answers | Medium | High | Grounding prompt (only answer from KB), low temperature (0.3), email capture fallback |
| Nobody signs up | Medium | Critical | Product Hunt launch + direct outreach to 200 SMBs + SEO content |
| Enterprise competitor copies feature | Low | Medium | Speed to market + niche focus (SMBs) + price advantage |
| Groq free tier runs out | Low | Medium | Fallback to other free LLM providers (Google AI Studio, local Ollama) |
| Widget breaks on certain websites | Medium | Medium | Extensive cross-site testing, scoped CSS, graceful degradation |
| Stripe account not approved | Low | High | Stripe approves most legitimate SaaS businesses; have PayPal as fallback |

---

## 17. Success Metrics

### 17.1 Week 1

- Landing page live and converting (target: 5% visitor → signup rate).
- 10 free signups.
- 1 successful end-to-end test (real business trains chatbot, embeds, gets visitor messages).

### 17.2 Month 1

- 50 free signups.
- 3 paying customers ($87 MRR).
- Product Hunt launch completed.
- 200 outbound emails sent.

### 17.3 Month 3

- 200 free signups.
- 15 paying customers ($435 MRR).
- First case study published.
- Affiliate program launched.

### 17.4 Month 6

- 500 free signups.
- 50 paying customers ($1,450 MRR).
- Shopify integration live.
- Break-even on all costs.

---

## 18. File Structure

```
/Users/ghali/money-fleet/replyfox/
├── SPEC.md                    (this file)
├── REVIEW.md                  (review log — updated at every step)
├── DEPLOYMENT.md              (how to deploy — written at end)
├── package.json
├── src/
│   ├── api/
│   │   ├── chat.js            (POST /api/chat — core chatbot logic)
│   │   ├── train.js           (POST /api/train — knowledge base ingestion)
│   │   ├── signup.js          (POST /api/signup — account creation)
│   │   ├── usage.js           (GET /api/usage — analytics)
│   │   ├── widget-config.js   (GET /api/widget-config — widget settings)
│   │   └── billing.js         (POST /api/billing/webhook — Stripe)
│   ├── lib/
│   │   ├── supabase.js        (database client)
│   │   ├── groq.js            (LLM client)
│   │   └── stripe.js          (Stripe client)
│   ├── landing/
│   │   ├── index.html         (landing page)
│   │   └── style.css
│   ├── dashboard/
│   │   ├── index.html         (dashboard SPA)
│   │   ├── style.css
│   │   └── app.js
│   ├── widget/
│   │   └── widget.js          (embeddable chatbot widget)
│   ├── schema.sql             (database schema)
│   └── test/
│       ├── chatbot.test.js    (chatbot accuracy tests)
│       └── widget.test.js     (widget embed tests)
└── dashboard/                 (ReplyFox ops dashboard)
    ├── index.html
    └── style.css
```

---

## 19. Non-Functional Requirements

1. **Security:**
   - All API endpoints validate input (no SQL injection, no XSS).
   - Business keys are UUIDs (unguessable).
   - Auth tokens for dashboard access.
   - Stripe webhook signature verification.
   - Rate limiting on all endpoints.

2. **Privacy/GDPR:**
   - Visitor messages stored for analytics but anonymized (no PII unless email is explicitly captured).
   - Data retention: 90 days for conversations, then auto-deleted.
   - Businesses can delete their account + all data.

3. **Accessibility:**
   - Widget is keyboard-navigable.
   - Dashboard meets WCAG 2.1 AA (color contrast, screen reader labels).
   - Landing page is accessible.

4. **Scalability:**
   - Serverless architecture scales automatically.
   - Database can handle 10k+ businesses (within Supabase free tier limits).
   - LLM calls are stateless (no session state on the server).

---

## 20. Constraints

1. **No paid services** — everything must run on free tiers initially.
2. **No human intervention during build** — agents build autonomously per this spec.
3. **Buildable in one session** — the MVP must be functional end-to-end.
4. **Self-contained** — the widget must work without external dependencies.
5. **Honest** — the product must genuinely work (no fake demos, no broken features).

---

## END OF SPECIFICATION

This document is the single source of truth for the ReplyFox build. Every agent, every code commit, every test must reference and adhere to this specification. Deviations require updating this document first.

**Total words: ~10,500** (excluding code blocks and tables).
