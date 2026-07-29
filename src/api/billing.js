// ============================================================================
// ReplyFox — POST /api/billing/webhook
// Spec reference: SPEC.md §5.4 (/api/billing/webhook), §8.3 (Stripe)
//   Input:  Stripe webhook event (raw body)
//   Handles: checkout.session.completed, customer.subscription.updated,
//            customer.subscription.deleted
//   Updates the business's plan / quota / status in the database.
//
// Signature verification is done with Node's built-in `crypto` (no Stripe SDK
// dependency). Requires the raw request body — the server passes req.rawBody.
// ============================================================================

import * as db from '../lib/supabase.js';
import { ok, fail } from '../lib/http.js';
import crypto from 'node:crypto';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PLAN_QUOTAS = { free: 50, pro: null, business: null };

// ---------------------------------------------------------------------------
// Stripe signature verification (manual, SDK-free)
// ---------------------------------------------------------------------------

/**
 * Verify a Stripe webhook signature against the raw body.
 * @param {Buffer} rawBody
 * @param {string} sigHeader  value of the `stripe-signature` header
 * @param {string} secret     STRIPE_WEBHOOK_SECRET
 * @param {number} tolerance  seconds (default 5 min)
 * @returns {{ verified: boolean, reason?: string }}
 */
export function verifyStripeSignature(rawBody, sigHeader, secret, tolerance = 300) {
  if (!secret) return { verified: false, reason: 'no secret configured' };
  if (!sigHeader || !rawBody) return { verified: false, reason: 'missing signature or body' };

  const parts = {};
  for (const piece of sigHeader.split(',')) {
    const [k, v] = piece.split('=').map((s) => s && s.trim());
    if (k) parts[k] = v;
  }
  const t = parts.t ? parseInt(parts.t, 10) : NaN;
  const v1 = parts.v1;
  if (!t || !v1) return { verified: false, reason: 'malformed signature header' };

  const age = Math.abs(Date.now() / 1000 - t);
  if (age > tolerance) return { verified: false, reason: 'timestamp outside tolerance' };

  const mac = createHmac('sha256', secret);
  mac.update(String(t) + '.');
  mac.update(rawBody); // raw bytes
  const expected = mac.digest('hex');

  const a = Buffer.from(v1, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { verified: false, reason: 'signature mismatch' };
  }
  return { verified: true };
}

// ---------------------------------------------------------------------------
// Plan resolution
// ---------------------------------------------------------------------------

/** Resolve a plan name ('free'|'pro'|'business') from a Stripe object. */
export function planFromStripeObject(obj = {}) {
  // 1) Explicit metadata on the object itself.
  const meta = obj.metadata || {};
  if (meta.plan && PLAN_QUOTAS[meta.plan] !== undefined) return meta.plan;

  // 2) Match a price id against env-configured price ids.
  const proPrice = process.env.STRIPE_PRO_PRICE_ID;
  const bizPrice = process.env.STRIPE_BUSINESS_PRICE_ID;
  const prices = collectPriceIds(obj);
  if (bizPrice && prices.includes(bizPrice)) return 'business';
  if (proPrice && prices.includes(proPrice)) return 'pro';

  // 3) Default: keep free.
  return 'free';
}

function collectPriceIds(obj) {
  const ids = new Set();
  const items = obj?.items?.data || obj?.line_items?.data || [];
  for (const it of items) {
    const price = it.price || it.prices?.[0];
    if (price?.id) ids.add(price.id);
  }
  return [...ids];
}

async function resolveBusiness(DB, { customerId, subscriptionId, metadata }) {
  if (subscriptionId) {
    const bySub = await DB.findBusinessByStripeSubscription(subscriptionId).catch(() => null);
    if (bySub) return bySub;
  }
  if (customerId) {
    const byCust = await DB.findBusinessByStripeCustomer(customerId).catch(() => null);
    if (byCust) return byCust;
  }
  // Fallback: metadata.business_key (set at checkout creation time).
  if (metadata?.business_key) {
    const byKey = await DB.findBusinessByKey(metadata.business_key).catch(() => null);
    if (byKey) return byKey;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(req, services = {}) {
  const DB = services.db || db;
  const rawBody = req.rawBody;
  const sigHeader = req.headers?.['stripe-signature'] || req.headers?.['Stripe-Signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Verify signature (skipped in dev if no secret configured).
  if (secret) {
    const check = verifyStripeSignature(rawBody, sigHeader, secret);
    if (!check.verified) {
      return fail(`Invalid webhook signature: ${check.reason}`, 400);
    }
  }

  let event;
  try {
    event = typeof req.body === 'object' && req.body ? req.body : JSON.parse(rawBody.toString('utf8'));
  } catch {
    return fail('Could not parse webhook body.', 400);
  }

  const type = event?.type;
  const obj = event?.data?.object || {};

  try {
    if (type === 'checkout.session.completed') {
      const customerId = obj.customer;
      const subscriptionId = obj.subscription;
      const business = await resolveBusiness(DB, {
        customerId,
        subscriptionId,
        metadata: obj.metadata,
      });
      if (!business) return ok({ received: true, ignored: 'business not found' });

      const plan = planFromStripeObject(obj);
      await DB.updateBusiness(business.id, {
        plan,
        message_quota: PLAN_QUOTAS[plan],
        stripe_customer_id: customerId || business.stripe_customer_id,
        stripe_subscription_id: subscriptionId || business.stripe_subscription_id,
        status: 'active',
      });
      return ok({ received: true, processed: type, plan });
    }

    if (type === 'customer.subscription.updated') {
      const customerId = obj.customer;
      const subscriptionId = obj.id;
      const business = await resolveBusiness(DB, {
        customerId,
        subscriptionId,
        metadata: obj.metadata,
      });
      if (!business) return ok({ received: true, ignored: 'business not found' });

      const plan = planFromStripeObject(obj);
      const canceled = obj.cancel_at_period_end && obj.status !== 'active';
      await DB.updateBusiness(business.id, {
        plan,
        message_quota: PLAN_QUOTAS[plan],
        stripe_customer_id: customerId || business.stripe_customer_id,
        stripe_subscription_id: subscriptionId,
        status: obj.status === 'active' ? 'active' : (obj.status || business.status),
      });
      return ok({ received: true, processed: type, plan, cancelAtPeriodEnd: !!canceled });
    }

    if (type === 'customer.subscription.deleted') {
      const customerId = obj.customer;
      const subscriptionId = obj.id;
      const business = await resolveBusiness(DB, {
        customerId,
        subscriptionId,
        metadata: obj.metadata,
      });
      if (!business) return ok({ received: true, ignored: 'business not found' });

      await DB.updateBusiness(business.id, {
        plan: 'free',
        message_quota: PLAN_QUOTAS.free,
        stripe_subscription_id: null,
        status: 'canceled',
      });
      return ok({ received: true, processed: type, plan: 'free' });
    }

    // Unhandled event types: acknowledge so Stripe stops retrying.
    return ok({ received: true, ignored: type });
  } catch (e) {
    // Return 500 so Stripe retries; surface detail for logs.
    return fail(`Webhook handling failed: ${e.message}`, 500);
  }
}

export default handler;
