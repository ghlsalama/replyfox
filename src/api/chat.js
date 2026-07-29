// ============================================================================
// ReplyFox — POST /api/chat  (the CORE endpoint)
// Spec reference: SPEC.md §4.3 (data flow), §5.4 (/api/chat), §7 (prompts)
//
//   Input:  { businessKey, message, sessionId }
//   Flow:   lookup business → get knowledge base → build system prompt (§7.1)
//           → call Groq (Llama 3.3 70B, temp 0.3, max 300) → store message
//           → detect email-capture pattern → return reply
//   Output: { reply, captured, emailRequest, sessionId }
//
// Handlers are pure: `async (req, services) => { status, body }`. `services`
// defaults to the real { db, llm } libs but can be overridden in tests.
// ============================================================================

import * as db from '../lib/supabase.js';
import * as llm from '../lib/groq.js';
import { ok, fail, assert, uuid } from '../lib/http.js';

// Reasonable email pattern for the capture flow (§7.3).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ----------------------------------------------------------------------------
// System prompt — SPEC §7.1 (verbatim structure)
// ----------------------------------------------------------------------------

/**
 * Build the chat system prompt EXACTLY per SPEC.md §7.1.
 *
 * @param {object} args
 * @param {string} args.businessName
 * @param {string} [args.knowledgeBaseContent]
 * @param {object|string} [args.businessHours]  JSONB column or stringified hours
 * @returns {string}
 */
export function buildSystemPrompt({
  businessName,
  knowledgeBaseContent,
  businessHours,
}) {
  const name = businessName || 'this business';
  const kb = knowledgeBaseContent
    ? knowledgeBaseContent.trim()
    : '(No knowledge base has been provided yet. Answer conservatively and offer to capture the visitor\'s email for follow-up.)';

  let hoursLine = 'Not specified';
  if (businessHours) {
    hoursLine =
      typeof businessHours === 'string'
        ? businessHours
        : JSON.stringify(businessHours);
  }

  // NOTE: the body below is intentionally byte-for-byte with SPEC.md §7.1
  // (rules 1-7, section headers, placeholders). Do not reformat.
  return `You are a customer support agent for ${name}. Your job is to help visitors by answering their questions accurately and friendly.

CRITICAL RULES:
1. Answer ONLY based on the information provided below. Do NOT make up facts.
2. If you don't know the answer or the question is outside the provided information, say: "I'm not sure about that one — could you leave your email so our team can follow up with you?"
3. Be concise (2-3 sentences max per response unless the visitor asks for detail).
4. Be friendly and professional. Use the business's tone.
5. If the visitor seems ready to buy or book, encourage them gently.
6. Never discuss competitors, politics, or sensitive topics.
7. If asked about pricing, quote exactly what's in the knowledge base. Don't estimate.

BUSINESS KNOWLEDGE BASE:
${kb}

BUSINESS NAME: ${name}
BUSINESS HOURS: ${hoursLine}`;
}

// ----------------------------------------------------------------------------
// Email-capture detection — SPEC §7.3
// ----------------------------------------------------------------------------

/** True when the LLM reply signals an email-capture / follow-up request. */
export function isEmailCaptureRequest(reply) {
  if (!reply) return false;
  const text = reply.toLowerCase();
  // SPEC §7.3: response contains "leave your email" or "follow up".
  return (
    text.includes('leave your email') ||
    text.includes('follow up') ||
    text.includes("leave your email")
  );
}

// ----------------------------------------------------------------------------
// Free-tier enforcement — SPEC §15.1 #4
// ----------------------------------------------------------------------------

function quotaExceeded(business) {
  // Pro/business have effectively unlimited messages (store null/large quota).
  const plan = (business.plan || 'free').toLowerCase();
  if (plan === 'pro' || plan === 'business') return false;
  const quota = business.message_quota ?? 50;
  if (quota == null) return false;
  return (business.messages_this_month ?? 0) >= quota;
}

const UPGRADE_MESSAGE =
  "You've reached your free message limit for this month. Upgrade to Pro for unlimited 24/7 answers — leave your email and our team will send you the details!";

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

/**
 * @param {object} req   { body, query }
 * @param {object} [services]  { db?, llm? }
 */
export async function handler(req, services = {}) {
  const DB = services.db || db;
  const LLM = services.llm || llm;

  const body = req.body || {};
  const businessKey = body.businessKey || body.business_key;
  const message = body.message;
  let sessionId = body.sessionId || body.session_id;

  try {
    assert(businessKey, 'businessKey is required.');
    assert(typeof message === 'string' && message.trim(), 'message is required.');
    if (!sessionId) sessionId = uuid();
  } catch (e) {
    return fail(e.message, e.statusCode || 400);
  }

  // 1. Lookup business by public key.
  let business;
  try {
    business = await DB.findBusinessByKey(businessKey);
  } catch (e) {
    return fail('Database error looking up business.', 503, { detail: e.message });
  }
  if (!business) {
    return fail('Business not found for that key.', 404);
  }
  if (business.status && business.status === 'canceled') {
    return fail('This account is no longer active.', 403);
  }

  // Satisfaction feedback (widget 👍/👎 — SPEC §5.3). The widget posts a typed
  // signal { feedbackFor, message: '__satisfaction__:<up|down>' } after each bot
  // reply. Route it to setSatisfaction instead of treating it as visitor text
  // (which would waste an LLM call and store a meaningless message).
  if (
    body.feedbackFor &&
    typeof message === 'string' &&
    message.startsWith('__satisfaction__:')
  ) {
    const sat = message.split(':')[1] === 'down' ? 'down' : 'up';
    try {
      // Resolve the conversation lazily so feedback works even before a reply.
      const convId = await DB.getOrCreateConversation(business.id, sessionId);
      await DB.setSatisfaction(convId, sat);
    } catch (e) {
      /* analytics-only; never block the visitor */
    }
    return ok({ received: true, satisfaction: sat, sessionId });
  }

  // 2. Free-tier quota enforcement.
  if (quotaExceeded(business)) {
    return ok({
      reply: UPGRADE_MESSAGE,
      captured: false,
      emailRequest: true, // invite an email so the owner can re-engage
      quotaExceeded: true,
      plan: business.plan,
      sessionId,
    });
  }

  // 3. Gather knowledge base + widget config (for hours).
  let knowledgeBase = null;
  let widgetConfig = null;
  try {
    [knowledgeBase, widgetConfig] = await Promise.all([
      DB.getKnowledgeBase(business.id).catch(() => null),
      DB.getWidgetConfig(business.id).catch(() => null),
    ]);
  } catch (e) {
    // non-fatal; continue with empty KB
  }

  // 4. Build the system prompt (§7.1).
  const systemPrompt = buildSystemPrompt({
    businessName: widgetConfig?.business_name || business.business_name,
    knowledgeBaseContent: knowledgeBase?.content,
    businessHours: widgetConfig?.business_hours,
  });

  // 5. Get-or-create the conversation for this session.
  let conversationId = null;
  try {
    conversationId = await DB.getOrCreateConversation(business.id, sessionId);
  } catch (e) {
    /* analytics-only; swallow */
  }

  // Email-capture flow (§7.3): the widget submits the visitor's email after the
  // bot requested it. Store it on the conversation, mark escalated, and skip the
  // LLM call (no point asking the model to handle an email address).
  if (body.emailCapture && EMAIL_RE.test(message)) {
    const reply =
      "Thanks! I've got your email — our team will reach out to you soon. Is there anything else I can help with?";
    try {
      if (conversationId) await DB.captureEmail(conversationId, message);
      await DB.storeMessage({
        conversationId,
        businessId: business.id,
        role: 'visitor',
        content: message,
      });
      await DB.storeMessage({
        conversationId,
        businessId: business.id,
        role: 'bot',
        content: reply,
      });
    } catch (e) {
      /* non-fatal */
    }
    return ok({ reply, captured: true, emailCaptured: true, sessionId });
  }

  // Store the visitor's message (best-effort, never block the reply).
  try {
    await DB.storeMessage({
      conversationId,
      businessId: business.id,
      role: 'visitor',
      content: message,
    });
  } catch (e) {
    /* analytics-only; swallow */
  }

  // 6. Call Groq (Llama 3.3 70B, temp 0.3, max 300 tokens — §7.2).
  let reply;
  try {
    const out = await LLM.chatCompletion({ system: systemPrompt, user: message });
    reply = out.reply;
  } catch (e) {
    return fail(
      "I couldn't reach the AI service just now. Please try again.",
      503,
      { detail: e.message }
    );
  }

  // 7. Detect email-capture intent (§7.3).
  const emailRequest = isEmailCaptureRequest(reply);

  // 8. Store the bot reply (best-effort).
  try {
    await DB.storeMessage({
      conversationId,
      businessId: business.id,
      role: 'bot',
      content: reply,
      emailRequest,
    });
  } catch (e) {
    /* analytics-only; swallow */
  }

  // 9. Bump usage counters.
  try {
    await DB.incrementUsage(business.id);
  } catch (e) {
    /* non-fatal */
  }

  return ok({
    reply,
    captured: emailRequest,
    emailRequest,
    sessionId,
  });
}

export default handler;
