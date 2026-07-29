<div align="center">

# 🦊 ReplyFox

### AI Customer Support Chatbot for Small Businesses

**$29/month · Live in 5 minutes · No coding required**

[Demo](#quick-demo) · [Spec](SPEC.md) · [Deploy](DEPLOYMENT.md) · [Launch Kit](PRODUCTHUNT.md)

</div>

---

## What It Does

ReplyFox turns any business's website content into a 24/7 AI chatbot. A business owner pastes their URL, ReplyFox trains a chatbot on their content, and they embed it with one line of code. Visitors get instant answers — no more missed questions after hours.

**The problem:** 68% of website visitors arrive after hours. Their questions go unanswered. They leave. Enterprise chatbot tools cost $74-$500/month — unaffordable for small businesses.

**The solution:** ReplyFox — $29/month, AI-native, trained on YOUR content, 5-minute setup.

## Quick Demo

```bash
git clone https://github.com/ghlsalama/replyfox.git
cd replyfox
npm install
npm run demo
```

Open **http://localhost:3000/demo** — you'll see a mock bakery website with the ReplyFox chatbot live. Try asking about hours, prices, delivery.

**Zero credentials needed** — runs in demo mode with mock data automatically.

## How It Works

```
1. Business owner signs up → pastes website URL or FAQ
2. ReplyFox ingests the content → trains an AI knowledge base
3. They copy one line of embed code → paste into their website
4. Visitors chat with the AI → get instant answers 24/7
```

## Features

- 🤖 **AI-Powered** — Grounded in YOUR content (no hallucinations on topics outside your knowledge base)
- ⚡ **Instant Setup** — From signup to live chatbot in 5 minutes
- 🌍 **24/7 Availability** — Never miss a question, any language, any timezone
- 🎨 **Customizable** — Brand colors, greeting, avatar, position, business hours
- 📊 **Analytics** — Message trends, top questions, satisfaction scores, email captures
- 💬 **Lead Capture** — When the bot can't answer, it captures the visitor's email
- 💰 **Affordable** — $29/month flat (vs $74+ for enterprise tools)

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS (no framework) | $0 |
| Backend | Node.js (built-in HTTP, no Express) | $0 |
| Database | Supabase (PostgreSQL) | $0 (free tier) |
| LLM | Groq (Llama 3.3 70B) | $0 (free tier) |
| Payments | Stripe | $0 (per-sale fee) |
| Widget | Self-contained vanilla JS (20KB) | $0 |

## Architecture

```
Landing Page ──→ Dashboard ──→ Widget (embeds on any site)
                      │                │
                      ▼                ▼
                   Backend API (Node.js)
                   ├── Supabase (DB)
                   ├── Groq (LLM)
                   └── Stripe (Billing)
```

## Pricing

| Free | Pro ($29/mo) | Business ($99/mo) |
|---|---|---|
| 50 messages/month | Unlimited | Unlimited |
| 1 knowledge base | 5 knowledge bases | Unlimited |
| Basic widget | Full customization | White-label |
| — | Analytics | API access + multi-seat |

## Documentation

- **[SPEC.md](SPEC.md)** — Full 10,500-word product specification
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Step-by-step deployment guide
- **[REVIEW.md](REVIEW.md)** — Build log (updated at every step)
- **[PRODUCTHUNT.md](PRODUCTHUNT.md)** — Product Hunt launch kit
- **[OUTREACH.md](OUTREACH.md)** — Customer outreach templates

## Tests

```bash
npm test    # 16/16 tests pass
```

Covers: system prompt structure (§7.1), email capture detection (§7.3), chat validation, KB answer accuracy, free-tier quota enforcement, HTML-to-text training, billing HMAC verification, plan resolution.

## License

MIT — build freely on this.

---

<div align="center">

**Built by autonomous agents** per a 10,500-word specification.

The money move. 🦊

</div>
