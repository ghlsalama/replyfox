// ============================================================================
// ReplyFox — POST /api/signup
// Spec reference: SPEC.md §5.4 (/api/signup)
//   Input:  { email, password, businessName }
//   Output: { businessKey, token, businessId, embedCode }
//   Rate limit: 5/hour per IP (best-effort, in-process — see note below).
//
// Creates a business record + default widget_config and returns the public
// business_key (UUID) used to embed the widget, plus a dashboard token.
// ============================================================================

import * as db from '../lib/supabase.js';
import { ok, fail, assert, uuid } from '../lib/http.js';

// Very small in-memory rate limiter (per IP). NOTE: in a serverless deployment
// each instance has its own memory; for real per-IP limits use Cloudflare's
// rate-limiting rules or Upstash. This covers a single long-lived process.
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SIGNUP_MAX = 5;
const signupHits = new Map();

export function _rateLimit(ip) {
  const now = Date.now();
  const cutoff = now - SIGNUP_WINDOW_MS;
  const arr = (signupHits.get(ip) || []).filter((t) => t > cutoff);
  arr.push(now);
  signupHits.set(ip, arr);
  return arr.length <= SIGNUP_MAX;
}

function clientIp(req) {
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers?.['cf-connecting-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function publicBaseUrl() {
  return process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

export async function handler(req, services = {}) {
  const DB = services.db || db;
  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;
  const businessName = (body.businessName || body.business_name || '').trim();

  // Rate limit
  const ip = clientIp(req);
  if (!_rateLimit(ip)) {
    return fail('Too many signups from this IP. Try again later.', 429);
  }

  try {
    assert(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'A valid email is required.');
    assert(typeof password === 'string' && password.length >= 8, 'Password must be at least 8 characters.');
    assert(businessName, 'businessName is required.');
  } catch (e) {
    return fail(e.message, e.statusCode || 400);
  }

  // Unique email
  try {
    const existing = await DB.findBusinessByEmail(email);
    if (existing) {
      return fail('An account with that email already exists.', 409);
    }
  } catch (e) {
    return fail('Database error checking email.', 503, { detail: e.message });
  }

  const businessKey = uuid();
  // MVP: the dashboard access token IS the business key. Production should
  // wire Supabase Auth and return its JWT here (kept separate for forward-compat).
  const token = businessKey;

  let business;
  try {
    business = await DB.createBusiness({ email, businessName, businessKey });
  } catch (e) {
    return fail('Could not create account.', 500, { detail: e.message });
  }

  const embedCode = `<script src="${publicBaseUrl()}/widget.js" data-key="${businessKey}"></script>`;

  return ok(
    {
      businessKey,
      token,
      businessId: business.id,
      plan: business.plan,
      embedCode,
    },
    201
  );
}

export default handler;
