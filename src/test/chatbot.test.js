// ============================================================================
// ReplyFox — tests for the chat endpoint (+ supporting units)
// Run: `npm test`  (uses Node's built-in test runner — no extra deps)
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import chatHandler, {
  buildSystemPrompt,
  isEmailCaptureRequest,
} from '../api/chat.js';
import { chunkText, htmlToText } from '../api/train.js';
import { verifyStripeSignature, planFromStripeObject } from '../api/billing.js';
import { createHmac } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mock services factory. Handlers accept { db, llm } overrides so we never
// touch Supabase/Groq/network here — tests are hermetic and fast.
// ---------------------------------------------------------------------------
function mockServices(opts = {}) {
  const calls = {
    storeMessage: [],
    llmCalls: [],
    usage: 0,
    capturedEmail: null,
    llmReply: opts.llmReply ?? 'Sure — happy to help!',
  };
  const services = {
    db: {
      findBusinessByKey: async (key) =>
        opts.businessNotFound
          ? null
          : {
              id: 'biz-1',
              business_name: opts.businessName ?? 'ACME Widgets',
              business_key: key,
              plan: opts.plan ?? 'pro',
              message_quota: opts.quota ?? null,
              messages_this_month: opts.messagesThisMonth ?? 0,
              status: opts.status ?? 'active',
            },
      getKnowledgeBase: async () =>
        opts.noKb ? null : { content: opts.kb ?? 'We ship worldwide. Returns within 30 days. Open Mon-Fri 9-17.' },
      getWidgetConfig: async () =>
        opts.noConfig ? null : { business_hours: { mon: '9-17', tue: '9-17' } },
      getOrCreateConversation: async () => 'conv-1',
      storeMessage: async (m) => {
        calls.storeMessage.push(m);
        return { id: 'msg-' + calls.storeMessage.length };
      },
      captureEmail: async (_id, email) => {
        calls.capturedEmail = email;
        return {};
      },
      incrementUsage: async () => {
        calls.usage += 1;
      },
    },
    llm: {
      chatCompletion: async (o) => {
        calls.llmCalls.push(o);
        return { reply: calls.llmReply };
      },
    },
  };
  return { services, calls };
}

function req(body = {}, extra = {}) {
  return { body, query: {}, headers: {}, ...extra };
}

// ---------------------------------------------------------------------------
// §7.1 — system prompt construction (the load-bearing correctness check)
// ---------------------------------------------------------------------------
describe('buildSystemPrompt (SPEC §7.1)', () => {
  it('embeds business name, knowledge base, and hours in the exact structure', () => {
    const prompt = buildSystemPrompt({
      businessName: 'ACME Widgets',
      knowledgeBaseContent: 'We ship worldwide. Returns within 30 days.',
      businessHours: { mon: '9-17' },
    });

    assert.match(prompt, /^You are a customer support agent for ACME Widgets\./);
    assert.match(prompt, /Your job is to help visitors by answering their questions accurately and friendly\./);

    // All 7 critical rules present verbatim.
    assert.match(prompt, /1\. Answer ONLY based on the information provided below\. Do NOT make up facts\./);
    assert.match(prompt, /could you leave your email so our team can follow up with you\?/);
    assert.match(prompt, /3\. Be concise \(2-3 sentences max/);
    assert.match(prompt, /6\. Never discuss competitors, politics, or sensitive topics\./);
    assert.match(prompt, /7\. If asked about pricing, quote exactly what's in the knowledge base\./);

    // Knowledge base + headers substituted.
    assert.match(prompt, /BUSINESS KNOWLEDGE BASE:\nWe ship worldwide/);
    assert.match(prompt, /BUSINESS NAME: ACME Widgets/);
    assert.match(prompt, /BUSINESS HOURS: \{"mon":"9-17"\}/);
  });

  it('falls back to a placeholder when no knowledge base is present', () => {
    const prompt = buildSystemPrompt({ businessName: 'Solo' });
    assert.match(prompt, /No knowledge base has been provided yet/);
    assert.match(prompt, /BUSINESS HOURS: Not specified/);
  });
});

describe('isEmailCaptureRequest (SPEC §7.3)', () => {
  it('flags "leave your email" and "follow up" replies', () => {
    assert.equal(isEmailCaptureRequest('Could you leave your email so we can follow up?'), true);
    assert.equal(isEmailCaptureRequest('Our team will follow up with you.'), true);
    assert.equal(isEmailCaptureRequest('We ship worldwide!'), false);
    assert.equal(isEmailCaptureRequest(''), false);
  });
});

// ---------------------------------------------------------------------------
// /api/chat handler
// ---------------------------------------------------------------------------
describe('POST /api/chat', () => {
  it('validates required fields', async () => {
    assert.equal((await chatHandler(req({}))).status, 400);
    assert.equal((await chatHandler(req({ businessKey: 'k' }))).status, 400);
    assert.equal((await chatHandler(req({ businessKey: 'k', message: '   ' }))).status, 400);
  });

  it('returns 404 for an unknown business key', async () => {
    const { services } = mockServices({ businessNotFound: true });
    const res = await chatHandler(req({ businessKey: 'nope', message: 'hi' }), services);
    assert.equal(res.status, 404);
  });

  it('answers from the knowledge base and stores both messages + usage', async () => {
    const { services, calls } = mockServices({ llmReply: 'Yes, we ship worldwide!' });
    const res = await chatHandler(
      req({ businessKey: 'k', message: 'Do you ship internationally?', sessionId: 's1' }),
      services
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.reply, 'Yes, we ship worldwide!');
    assert.equal(res.body.emailRequest, false);
    assert.equal(res.body.sessionId, 's1');

    // The LLM received the §7.1 system prompt with KB + business name.
    assert.equal(calls.llmCalls.length, 1);
    assert.match(calls.llmCalls[0].system, /You are a customer support agent for ACME Widgets/);
    assert.match(calls.llmCalls[0].system, /We ship worldwide/);
    assert.equal(calls.llmCalls[0].user, 'Do you ship internationally?');

    // Visitor + bot messages stored, usage bumped once.
    const roles = calls.storeMessage.map((m) => m.role);
    assert.deepEqual(roles, ['visitor', 'bot']);
    assert.equal(calls.usage, 1);
  });

  it('detects email-capture intent and surfaces emailRequest', async () => {
    const { services } = mockServices({
      llmReply: "I'm not sure about that one — could you leave your email so our team can follow up with you?",
    });
    const res = await chatHandler(req({ businessKey: 'k', message: 'Do you do franchising?' }), services);
    assert.equal(res.status, 200);
    assert.equal(res.body.emailRequest, true);
    assert.equal(res.body.captured, true);
  });

  it('enforces the free-tier quota and does NOT call the LLM', async () => {
    const { services, calls } = mockServices({
      plan: 'free',
      quota: 50,
      messagesThisMonth: 50,
    });
    const res = await chatHandler(req({ businessKey: 'k', message: 'hi' }), services);
    assert.equal(res.status, 200);
    assert.equal(res.body.quotaExceeded, true);
    assert.equal(res.body.emailRequest, true);
    assert.equal(calls.llmCalls.length, 0);
  });

  it('lets pro/business plans exceed the free quota', async () => {
    const { services, calls } = mockServices({
      plan: 'business',
      quota: null,
      messagesThisMonth: 99999,
    });
    const res = await chatHandler(req({ businessKey: 'k', message: 'hi' }), services);
    assert.equal(res.status, 200);
    assert.equal(res.body.quotaExceeded, undefined);
    assert.equal(calls.llmCalls.length, 1);
  });

  it('handles the emailCapture flow: stores email, skips the LLM', async () => {
    const { services, calls } = mockServices();
    const res = await chatHandler(
      req({ businessKey: 'k', message: 'jane@example.com', sessionId: 's1', emailCapture: true }),
      services
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.emailCaptured, true);
    assert.equal(calls.capturedEmail, 'jane@example.com');
    assert.equal(calls.llmCalls.length, 0);
  });

  it('returns 503 when the LLM call fails', async () => {
    const { services } = mockServices();
    services.llm.chatCompletion = async () => {
      throw new Error('groq down');
    };
    const res = await chatHandler(req({ businessKey: 'k', message: 'hi' }), services);
    assert.equal(res.status, 503);
  });

  it('routes widget 👍/👎 feedback to setSatisfaction (no LLM call, no quota burn)', async () => {
    const { services, calls } = mockServices({ llmReply: 'should not be used' });
    let satArg = null;
    services.db.setSatisfaction = async (_id, sat) => { satArg = sat; return {}; };
    const res = await chatHandler(
      req({ businessKey: 'k', sessionId: 's1', message: '__satisfaction__:down', feedbackFor: 'm-1' }),
      services
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    assert.equal(res.body.satisfaction, 'down');
    assert.equal(satArg, 'down');
    assert.equal(calls.llmCalls.length, 0);     // did NOT call the LLM
    assert.equal(calls.storeMessage.length, 0); // did NOT store a visitor message
  });
});

// ---------------------------------------------------------------------------
// /api/train helpers
// ---------------------------------------------------------------------------
describe('train.htmlToText + chunkText', () => {
  it('strips scripts/styles/tags and decodes entities', () => {
    const html =
      '<script>var x=1;</script><style>.a{}</style>' +
      '<nav>Home</nav><h1>Hello &amp; welcome</h1><p>We sell <b>widgets</b> for $5.</p>';
    const text = htmlToText(html);
    assert.equal(text.includes('var x'), false);
    assert.equal(text.includes('Home'), false);
    assert.ok(text.includes('Hello & welcome'));
    assert.ok(text.includes('widgets'));
  });

  it('chunks text into ~500-char sections', () => {
    const long = 'Sentence one. '.repeat(200); // ~2800 chars
    const chunks = chunkText(long, 500);
    assert.ok(chunks.length > 1);
    for (const c of chunks) assert.ok(c.length <= 520, 'chunk within size budget');
  });
});

// ---------------------------------------------------------------------------
// /api/billing helpers
// ---------------------------------------------------------------------------
describe('billing signature + plan resolution', () => {
  it('verifies a correct HMAC signature and rejects bad ones', () => {
    const secret = 'whsec_test';
    const payload = Buffer.from('{"id":"evt_1","type":"checkout.session.completed"}', 'utf8');
    const t = Math.floor(Date.now() / 1000);
    const mac = createHmac('sha256', secret);
    mac.update(String(t) + '.');
    mac.update(payload);
    const sig = mac.digest('hex');
    const header = `t=${t},v1=${sig}`;

    assert.equal(verifyStripeSignature(payload, header, secret).verified, true);
    assert.equal(
      verifyStripeSignature(payload, `t=${t},v1=deadbeef`, secret).verified,
      false
    );
    assert.equal(verifyStripeSignature(payload, header, 'wrong-secret').verified, false);
  });

  it('resolves plan from metadata, price id, or defaults to free', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
    process.env.STRIPE_BUSINESS_PRICE_ID = 'price_biz';
    assert.equal(planFromStripeObject({ metadata: { plan: 'pro' } }), 'pro');
    assert.equal(
      planFromStripeObject({ items: { data: [{ price: { id: 'price_biz' } }] } }),
      'business'
    );
    assert.equal(planFromStripeObject({ items: { data: [{ price: { id: 'price_pro' } }] } }), 'pro');
    assert.equal(planFromStripeObject({}), 'free');
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.STRIPE_BUSINESS_PRICE_ID;
  });
});
