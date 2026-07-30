// Mock in-memory database — activates when SUPABASE_URL is not set.
// Implements the same interface as supabase.js so all handlers work without credentials.
// Seeds a demo business so the widget is immediately functional.

const DEMO_KEY = 'demo-key-0001';
const DEMO_BUSINESS = {
  id: 'demo-001',
  email: 'owner@demobakery.com',
  business_name: 'Sunrise Bakery',
  business_key: DEMO_KEY,
  plan: 'pro',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  messages_this_month: 0,
  message_quota: null,
  status: 'active',
  created_at: new Date().toISOString(),
};

const DEMO_KB = {
  id: 'kb-001',
  business_id: 'demo-001',
  content: `Sunrise Bakery — Fresh Bread, Pastries, and Cakes Baked Daily.

HOURS: Monday–Friday 7:00 AM–6:00 PM, Saturday 8:00 AM–4:00 PM, Sunday Closed.
LOCATION: 42 Flour Street, Riverside. Phone: 555-0142.
DELIVERY: We Deliver Within 5 Miles for Orders Over $25. Same-Day Delivery if Ordered Before 2:00 PM.
MENU: Sourdough Bread ($6), Butter Croissants ($3.50 Each or 3 for $9), Custom Birthday Cakes (From $35), Vegan Options Available Daily.
ALLERGENS: All Products May Contain Wheat, Dairy, Eggs, and Nuts. Gluten-Free Options Available on Request (48-Hour Notice).
ORDERING: Order In-Store, by Phone (555-0142), or Via Our Website. Custom Cake Orders Require 72 Hours Notice.
PAYMENT: Cash, Card, Apple Pay. No Minimum Order for In-Store Purchases.
LOYALTY: Buy 10 Loaves, Get 1 Free. Ask for a Stamp Card.`,
  source: 'text',
  chunk_count: 9,
  created_at: new Date().toISOString(),
};

const DEMO_WIDGET = {
  business_id: 'demo-001',
  color: '#F59E0B',
  position: 'bottom-right',
  greeting: "Hi! Welcome to Sunrise Bakery. How can I help you today? 🥐",
  avatar: '🥐',
  business_name: 'Sunrise Bakery',
  business_hours: { mon: '7-18', tue: '7-18', wed: '7-18', thu: '7-18', fri: '7-18', sat: '8-16', sun: 'closed' },
  outside_hours_message: "We're currently closed! Leave your email and we'll get back to you when we open.",
};

// In-memory stores
const businesses = new Map([[DEMO_KEY, DEMO_BUSINESS], ['demo-001', DEMO_BUSINESS]]);
const knowledgeBases = new Map([['demo-001', DEMO_KB]]);
const widgetConfigs = new Map([['demo-001', DEMO_WIDGET]]);
const conversations = new Map();
const messages = [];
const usage = new Map();

export function getClient() { return null; }
export function __setClientForTest() {}

export async function findBusinessByKey(businessKey) {
  return businesses.get(businessKey) || null;
}
export async function findBusinessByEmail(email) {
  for (const b of businesses.values()) if (b.email === email) return b;
  return null;
}
export async function findBusinessByStripeCustomer(id) {
  for (const b of businesses.values()) if (b.stripe_customer_id === id) return b;
  return null;
}
export async function findBusinessByStripeSubscription(id) {
  for (const b of businesses.values()) if (b.stripe_subscription_id === id) return b;
  return null;
}
export async function createBusiness({ email, businessName, businessKey }) {
  const id = 'biz-' + Math.random().toString(36).slice(2, 10);
  const biz = { id, email, business_name: businessName, business_key: businessKey, plan: 'free', stripe_customer_id: null, stripe_subscription_id: null, messages_this_month: 0, message_quota: 50, status: 'active', created_at: new Date().toISOString() };
  businesses.set(businessKey, biz); businesses.set(id, biz);
  widgetConfigs.set(id, { business_id: id, color: '#4F46E5', position: 'bottom-right', greeting: 'Hi! How can I help you today?', avatar: '🤖', business_name: businessName, business_hours: null, outside_hours_message: "We're currently closed. Leave your email and we'll get back to you." });
  return biz;
}
export async function updateBusiness(businessId, patch) {
  const b = businesses.get(businessId); if (!b) return null;
  Object.assign(b, patch); return b;
}
export async function getKnowledgeBase(businessId) {
  return knowledgeBases.get(businessId) || null;
}
export async function addKnowledge({ businessId, content, source, sourceUrl }) {
  const kb = { id: 'kb-' + Math.random().toString(36).slice(2,8), business_id: businessId, content, source, source_url: sourceUrl, chunk_count: Math.ceil(content.length / 500), created_at: new Date().toISOString() };
  knowledgeBases.set(businessId, kb); return kb;
}
export async function getWidgetConfig(businessId) {
  return widgetConfigs.get(businessId) || null;
}
export async function getOrCreateConversation(businessId, sessionId) {
  const key = `${businessId}:${sessionId}`;
  if (!conversations.has(key)) {
    const id = 'conv-' + Math.random().toString(36).slice(2, 10);
    conversations.set(key, { id, business_id: businessId, session_id: sessionId, visitor_email: null, started_at: new Date().toISOString(), message_count: 0, escalated: false });
  }
  return conversations.get(key).id;
}
export async function storeMessage({ conversationId, businessId, role, content }) {
  messages.push({ id: 'msg-' + messages.length, conversation_id: conversationId, business_id: businessId, role, content, created_at: new Date().toISOString() });
}
export async function captureEmail(conversationId, email) {
  for (const c of conversations.values()) if (c.id === conversationId) { c.visitor_email = email; c.escalated = true; }
}
export async function setSatisfaction(conversationId, satisfaction) { /* no-op in mock */ }
export function monthBucket(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
export async function incrementUsage(businessId) {
  const bucket = monthBucket();
  const key = `${businessId}:${bucket}`;
  usage.set(key, (usage.get(key) || 0) + 1);
  const b = businesses.get(businessId); if (b) b.messages_this_month = (b.messages_this_month || 0) + 1;
}
export async function getUsage(businessId) {
  const bucket = monthBucket();
  return { messagesThisMonth: usage.get(`${businessId}:${bucket}`) || 0, quota: businesses.get(businessId)?.message_quota ?? 50, plan: businesses.get(businessId)?.plan || 'free' };
}
export async function getRecentMessages(businessId, limit = 20) {
  return messages.filter(m => m.business_id === businessId).slice(-limit).reverse();
}
export async function getTopQuestions(businessId, limit = 10) {
  return messages.filter(m => m.business_id === businessId && m.role === 'visitor').slice(-limit).map(m => ({ question: m.content, count: 1 }));
}
