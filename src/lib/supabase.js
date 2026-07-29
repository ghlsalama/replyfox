// ============================================================================
// ReplyFox — Supabase client + data-access layer
// Spec reference: SPEC.md §6 (schema), §6.2 (RLS), §5.4 (endpoints)
// ============================================================================
//
// All database access goes through the functions exported here so the API
// handlers stay thin and the data layer is trivially mockable in tests
// (handlers do `import * as db from '../lib/supabase.js'` and may override).
//
// Env:
//   SUPABASE_URL              — project URL
//   SUPABASE_ANON_KEY         — public anon key (per spec §5.4/§6.2)
//   SUPABASE_SERVICE_ROLE_KEY — service-role key (preferred for server writes,
//                               bypasses RLS). Falls back to anon if unset.

import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * Lazily build the Supabase client. Prefers the service-role key for the
 * backend (so writes aren't blocked by RLS), falling back to the anon key.
 */
export function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  // Per spec we read SUPABASE_ANON_KEY; service role is preferred when present.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY ' +
        '(and optionally SUPABASE_SERVICE_ROLE_KEY) in your environment.'
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Test-only: inject a fake client (or null to reset). */
export function __setClientForTest(client) {
  _client = client;
}

// ----------------------------------------------------------------------------
// Businesses
// ----------------------------------------------------------------------------

/** Look up a business by its public widget key. Returns the row or null. */
export async function findBusinessByKey(businessKey) {
  const { data, error } = await getClient()
    .from('businesses')
    .select('*')
    .eq('business_key', businessKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Look up a business by email. Returns the row or null. */
export async function findBusinessByEmail(email) {
  const { data, error } = await getClient()
    .from('businesses')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Look up a business by Stripe customer id. Returns the row or null. */
export async function findBusinessByStripeCustomer(stripeCustomerId) {
  const { data, error } = await getClient()
    .from('businesses')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Look up a business by Stripe subscription id. Returns the row or null. */
export async function findBusinessByStripeSubscription(stripeSubscriptionId) {
  const { data, error } = await getClient()
    .from('businesses')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Create a new business account + default widget_config row.
 * @returns {object} the created business row.
 */
export async function createBusiness({ email, businessName, businessKey }) {
  const supabase = getClient();
  const { data: business, error } = await supabase
    .from('businesses')
    .insert({
      email,
      business_name: businessName,
      business_key: businessKey,
      plan: 'free',
      message_quota: 50,
    })
    .select()
    .single();
  if (error) throw error;

  // Seed default widget configuration.
  await supabase.from('widget_config').insert({ business_id: business.id });

  return business;
}

/** Update arbitrary fields on a business. */
export async function updateBusiness(businessId, patch) {
  const { data, error } = await getClient()
    .from('businesses')
    .update(patch)
    .eq('id', businessId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Knowledge base
// ----------------------------------------------------------------------------

/** Returns the most recent knowledge_base row for a business (or null). */
export async function getKnowledgeBase(businessId) {
  const { data, error } = await getClient()
    .from('knowledge_base')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Insert a new knowledge_base entry. */
export async function addKnowledge({
  businessId,
  content,
  source,
  sourceUrl,
  chunkCount,
}) {
  const { data, error } = await getClient()
    .from('knowledge_base')
    .insert({
      business_id: businessId,
      content,
      source,
      source_url: sourceUrl,
      chunk_count: chunkCount,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Widget config
// ----------------------------------------------------------------------------

/** Returns the widget_config row for a business (or null). */
export async function getWidgetConfig(businessId) {
  const { data, error } = await getClient()
    .from('widget_config')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Conversations + messages
// ----------------------------------------------------------------------------

/** Get-or-create a conversation row for (business, session). Returns its id. */
export async function getOrCreateConversation(businessId, sessionId) {
  const supabase = getClient();
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('business_id', businessId)
    .eq('session_id', sessionId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ business_id: businessId, session_id: sessionId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Store a single message. Returns the created row. */
export async function storeMessage({
  conversationId,
  businessId,
  role,
  content,
  emailRequest = false,
}) {
  const { data, error } = await getClient()
    .from('messages')
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      role,
      content,
      email_request: emailRequest,
    })
    .select()
    .single();
  if (error) throw error;

  // Bump the conversation message_count.
  await getClient().rpc('increment_conversation_count', {
    p_conversation_id: conversationId,
  }).catch(() => {
    /* rpc may not exist; non-fatal */
  });

  return data;
}

/** Record a visitor email on the conversation + mark escalated. */
export async function captureEmail(conversationId, email) {
  const { data, error } = await getClient()
    .from('conversations')
    .update({ visitor_email: email, escalated: true })
    .eq('id', conversationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Set satisfaction (up/down) on the most recent bot message in a conversation. */
export async function setSatisfaction(conversationId, satisfaction) {
  const supabase = getClient();
  const { data: last } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('role', 'bot')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return null;
  const { data, error } = await supabase
    .from('messages')
    .update({ satisfaction })
    .eq('id', last.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Usage / analytics
// ----------------------------------------------------------------------------

/** "YYYY-MM" for a Date (UTC) — the bucket used by usage_log. */
export function monthBucket(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

/**
 * Increment usage for a business for the current month.
 * Updates both businesses.messages_this_month and usage_log (upsert).
 */
export async function incrementUsage(businessId) {
  const bucket = monthBucket();
  const supabase = getClient();

  // Upsert the monthly row (+1).
  const { error: logErr } = await supabase
    .from('usage_log')
    .upsert(
      {
        business_id: businessId,
        month_year: bucket,
        message_count: 1,
      },
      { onConflict: 'business_id,month_year' }
    );
  if (logErr) throw logErr;

  // Bump the denormalized counter on the business row via RPC when available,
  // otherwise read-modify-write.
  await supabase
    .rpc('increment_business_usage', { p_business_id: businessId })
    .catch(async () => {
      const { data: biz } = await supabase
        .from('businesses')
        .select('messages_this_month')
        .eq('id', businessId)
        .single();
      await supabase
        .from('businesses')
        .update({ messages_this_month: (biz?.messages_this_month || 0) + 1 })
        .eq('id', businessId);
    });

  return bucket;
}

/** Returns aggregated usage info for the dashboard. */
export async function getUsage(businessId) {
  const supabase = getClient();
  const { data: biz } = await supabase
    .from('businesses')
    .select('plan, message_quota, messages_this_month')
    .eq('id', businessId)
    .single();

  const bucket = monthBucket();
  const { data: monthRow } = await supabase
    .from('usage_log')
    .select('message_count')
    .eq('business_id', businessId)
    .eq('month_year', bucket)
    .maybeSingle();

  const messagesThisMonth = monthRow?.message_count ?? biz?.messages_this_month ?? 0;
  const quota = biz?.message_quota ?? 50;
  const plan = biz?.plan ?? 'free';

  return { messagesThisMonth, quota, plan };
}

/** Returns recent messages (both roles) for the dashboard activity feed. */
export async function getRecentMessages(businessId, limit = 20) {
  const { data, error } = await getClient()
    .from('messages')
    .select('id, role, content, satisfaction, created_at, conversation_id')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Returns the most-asked visitor questions (raw content) for analytics. */
export async function getTopQuestions(businessId, limit = 10) {
  const { data, error } = await getClient()
    .from('messages')
    .select('content, created_at')
    .eq('business_id', businessId)
    .eq('role', 'visitor')
    .order('created_at', { ascending: false })
    .limit(limit * 5);
  if (error) throw error;

  // Tally by normalized question text.
  const counts = new Map();
  for (const m of data || []) {
    const key = (m.content || '').trim().toLowerCase().slice(0, 120);
    if (!key) continue;
    const entry = counts.get(key) || { question: m.content.trim(), count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
