// ============================================================================
// ReplyFox — GET /api/usage
// Spec reference: SPEC.md §5.4 (/api/usage)
//   Auth:    Authorization: Bearer <token>   OR   ?key=<businessKey>
//   Output:  { messagesThisMonth, quota, plan, conversations, topQuestions }
//
// MVP auth note: the signup-issued token currently equals the business_key, so
// we resolve the business by key. Production should verify a Supabase Auth JWT
// here and map it to the business.
// ============================================================================

import * as db from '../lib/supabase.js';
import { ok, fail } from '../lib/http.js';

function resolveCredential(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && /^bearer\s+/i.test(auth)) {
    return auth.replace(/^bearer\s+/i, '').trim();
  }
  if (req.query?.token) return req.query.token;
  if (req.query?.key) return req.query.key;
  return null;
}

export async function handler(req, services = {}) {
  const DB = services.db || db;

  const credential = resolveCredential(req);
  if (!credential) {
    return fail('Authentication required (send Authorization: Bearer <token>).', 401);
  }

  let business;
  try {
    business = await DB.findBusinessByKey(credential);
  } catch (e) {
    return fail('Database error.', 503, { detail: e.message });
  }
  if (!business) {
    return fail('Invalid credentials.', 401);
  }

  let usage;
  try {
    usage = await DB.getUsage(business.id);
  } catch (e) {
    return fail('Could not load usage.', 503, { detail: e.message });
  }

  let topQuestions = [];
  let recent = [];
  try {
    [topQuestions, recent] = await Promise.all([
      DB.getTopQuestions(business.id, 10),
      DB.getRecentMessages(business.id, 20),
    ]);
  } catch (e) {
    /* analytics-only */
  }

  const remaining =
    usage.quota == null ? null : Math.max(0, usage.quota - usage.messagesThisMonth);

  return ok({
    messagesThisMonth: usage.messagesThisMonth,
    quota: usage.quota,
    remaining,
    plan: usage.plan,
    conversations: recent,
    topQuestions,
  });
}

export default handler;
